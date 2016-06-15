(function () {
    "use strict";

    const electron = require('electron');
    const ipcMain = electron.ipcMain;
    const app = electron.app;
    const BrowserWindow = electron.BrowserWindow;
    
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    const beautify = require('js-beautify').js_beautify;
    const Promise = require('promise');
    
    const listenPort = 8765;
    let server;
    let settings;
    let caseFolderPath = "";
    
    try {
        settings = JSON.parse(fs.readFileSync('package.json'));
    } catch(e) {
        settings = {};
    }
    
    process.on('uncaughtException', (err) => {
        console.error(err);
    });
    
    ipcMain.on('asynchronous-message', (event, arg) => {
        var args = JSON.parse(arg);
        console.log(args.type);
        switch (args.type) {
            case 'SET_FOLDER':
                caseFolderPath = args.data.folderPath;
                break;
            case 'START_PROXY':
                createProxy(event, args.data.isPhone);
                break;
            case 'INIT_ENV':
                initEnv(event, caseFolderPath);
                break;
            case 'CHECK_ENV':
                if (checkEnv(caseFolderPath)) {
                    event.sender.send('asynchronous-reply', 'HAS_INIT_ENV');
                }
                break;
        }
    });

    let mainWindow;
    const initWindowSize = {
        width: 700,
        height: 500
    };
    
    function createWindow() {
        mainWindow = new BrowserWindow({
            title: settings.name || "",
            width: initWindowSize.width,
            height: initWindowSize.height
        });
        mainWindow.loadURL('file://'+ __dirname + '/index.html');
        createServer();
        mainWindow.on('closed', () => {
            releaseWindow();
        });
    }
    
    function releaseWindow() {
        mainWindow = null;
    }
    
    function createServer() {
        server = http.createServer((req, res) => {
            var postData = "";
            req.on('data', (chunk) => {
                postData += chunk.toString();
            });
            req.on('end', () => {
                saveSpecCode(postData);
            });
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('ok');
        });
        server.listen(listenPort);
    }
    
    function releaseServer() {
        server.close();
    }
    
    function checkEnv(folder) {
        try {
            var files = ['package.json', 'Gruntfile.js', 'package.json'];
            for (var i = 0, filename; (filename = files[i]); i++) {
                if (!fs.statSync(path.join(folder, filename)).isFile()) {
                    return false;
                }
            }
            var folders = ['src', 'spec', 'coverage'];
            for (var i = 0, foldername; (foldername = folders[i]); i++) {
                if (!fs.statSync(path.join(folder, foldername)).isDirectory()) {
                    return false;
                }
            }
        } catch (e) {
            return false;
        }
        
        return true;
    }
    
    function initEnv(event, folder) {
        if (checkEnv(folder)) {
            event.returnValue = 'HAS_INIT_ENV';
            return;
        }
        fs.writeFile(path.join(folder, 'package.json'), fs.readFileSync('./env/package.json'));
        fs.writeFile(path.join(folder, 'Gruntfile.js'), fs.readFileSync('./env/Gruntfile.js'));
        fs.writeFile(path.join(folder, 'package.json'), fs.readFileSync('./env/package.json'));
        ['src', 'spec'].forEach(function (dirname) {
            fs.mkdir(path.join(folder, dirname));
        });
        fs.mkdir(path.join(folder, 'coverage'), function () {
            var lcov = path.join(folder, 'coverage', 'lcov-report');
            fs.mkdir(lcov, function () {
                ['index.html', 'prettify.css', 'prettify.js'].forEach(function (filename) {
                    fs.writeFile(path.join(lcov, filename), fs.readFileSync(path.join('./env', filename)));
                });
            });
        });
    }
    
    function createProxy(isPhone) {
        var istanbul = require('istanbul');
        var instrumenter = new istanbul.Instrumenter();
        var proxy = require('anyproxy');

        !proxy.isRootCAFileExists() && proxy.generateRootCA();

        var rule = {
            replaceRequestOption: (req, options) => {
                if (isPhone) {
                    options.headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4';
                }
                return options;
            },
            replaceResponseHeader: (req, res, headers) => {
                return headers;
            },
            replaceServerResDataAsync: (req, res, serverResData, callback) => {
                if (isJsFile(req.url)) {
                    var file_name = /([^/]+\.js)$/.exec(req.url)[1];
                    var file_content = serverResData.toString('utf8');
                    var generatedCode = hookWithJS(file_name, file_content);
                    return callback(new Buffer(generatedCode));
                } else if (req['content-type'] === 'text/html') {
                    var html = serverResData.toString('utf8');
                    var fileName = 0;
                    html = html.replace(/(\<script.*?\>)([\s\S]+?)\<\/script\>/ig, function (scriptStr, leftTag, jsStr) {
                        fileName++;
                        var generatedCode = hookWithJS(file_name, jsStr);                
                        return leftTag + generatedCode + '</script>';
                    });
                    return callback(new Buffer(html));
                }

                callback(serverResData);
            },
            shouldInterceptHttpsReq :(req) => {
                return true;
            }
        };

        var options = {
            type          : "http",
            port          : 3334,
            hostname      : "localhost",
            rule          : rule,
            dbFile        : null,  // optional, save request data to a specified file, will use in-memory db if not specified
            webPort       : 8002,  // optional, port for web interface
            socketPort    : 8003,  // optional, internal port for web socket, replace this when it is conflict with your own service
            // throttle      : 10,    // optional, speed limit in kb/s
            disableWebInterface : false, //optional, set it when you don't want to use the web interface
            silent        : false, //optional, do not print anything into terminal. do not set it when you are still debugging.
            interceptHttps: true
        };

        new proxy.proxyServer(options);

        function isJsFile(path) {
            return /\.js$/.test(path);
        }

        function hookWithJS(file_name, file_content) {
            var filepath = path.join(caseFolderPath, 'src', file_name);
            fs.writeFile(filepath, file_content);
            return instrumenter.instrumentSync(file_content, filepath);
        }
    }
    
    function saveSpecCode(codeObjStr) {
        if (!caseFolderPath) {
            return;
        }
        let codeObj;
        try {
            codeObj = JSON.parse(codeObjStr);
            fs.writeFileSync(path.join(caseFolderPath, 'spec', `${codeObj.name}.spec.js`), beautify(codeObj.code));
        } catch(e) {
            codeObj = {};
        }
    }

    app.on('ready', createWindow);
    app.on('window-all-closed', () => {
        releaseServer();
        if (process.platform !== 'darwin') {
            app.quite();
        }
    });
    
    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        }
    });
})();