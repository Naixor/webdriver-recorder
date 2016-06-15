'use strict';

chrome.manifest = chrome.app.getDetails();
chrome.version = navigator.appVersion.match(/Chrom[e|ium]\/(\S+)/)[1];

var Recorder = (function() {
    function Recorder() {
        var self = this;
        chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
            console.log("msg: ", msg);
            var tabId = sender.tab.id;
            if (!tabs[tabId]) {
                return;
            }
            //初始化消息
            if(msg.userAgent){
                if(!tabs[tabId]['base']){
                    tabs[tabId]['base'] = msg;
                    //获取指定cookie
                    var cookie_names = ['BAIDUID','BDUSS','BIDUPSID'];
                    chrome.cookies.getAll({domain : ".baidu.com"}, function(cookies) {
                        var _cookies = [];
                        for(var i=0; i<cookies.length;i++) {
                            if((cookie_names.indexOf(cookies[i].name) > -1 || sender.tab.url.indexOf(cookies[i].domain) > -1) ){
                                _cookies.push(cookies[i].name + "=" + cookies[i].value);
                            }
                        }
                        tabs[tabId]['base']['cookie'] = _cookies.join(";");
                    });
                }
            }else{
                msg.delay = window.options.step_delay;
                tabs[tabId].steps.push(msg);
                self.updateCounter(tabId);
                Notifier.show(''+tabId, msg);
            }

        });

        chrome.tabs.onUpdated.addListener(function(tabId, change, tab) {
            if (self.isRecording(tabId)) {
                self.updateCounter(tabId);
                Icon.turnOn(tabId);

                if (change.status == "complete") {
                    self.startRecording(tab);
                }
            }
        });

        chrome.tabs.onRemoved.addListener(function(tabId) {
            if (self.isRecording(tabId)) {
                delete tabs[tabId];
            }
        });

        chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
            if (request.getOptions) {
                sendResponse(window.options);
            }
        });
    }

    var tabs = [];

    var sendMessage = function(tabId, msg, callback) {
        chrome.tabs.sendMessage(tabId, msg, callback);
    };

    var injectScriptToPage = function(tabId, callback) {
        chrome.tabs.executeScript(tabId, { file: "inject.js" }, callback);        
    };

    var isRecorderInjected = function(tabId, callback) {
        chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
            chrome.tabs.executeScript(tabId, { code: "!!window.browserbiteRecorder" }, function(results) {
                callback(results && results[0]);
            });
        });
    };

    Recorder.prototype.startRecording = function(tab, callback) {
        var tabId = tab.id;
        if (!this.isRecording(tabId)) {
            tabs[tabId] = {
                chrome: {
                    extensionVersion: chrome.manifest.version,
                    version: chrome.version
                },
                case_name : window.options.case_name,
                initialUrl: tab.url,
                title: tab.title,
                steps: []
            };
        }

        tabs[tabId].isRecording = true;
        isRecorderInjected(tabId, function(isInjected) {
            var sendStartMessage = function() {
                sendMessage(tabId, { startRecording: true }, callback);
            };

            if (!isInjected) {
                injectScriptToPage(tabId, sendStartMessage);
            }
            else {
                sendStartMessage();
            }
        });

        Icon.turnOn(tabId);
        Icon.setBadgeCounter(tabId, tabs[tabId].steps.length + 1);
    };

    Recorder.prototype.stopRecording = function(tabId, callback) {
        tabs[tabId].isRecording = false;
        sendMessage(tabId, { stopRecording: true }, callback);
        // 
        Icon.turnOff(tabId);
    };

    Recorder.prototype.getData = function(tabId, callback) {
        callback(tabs[tabId]);
    };

    Recorder.prototype.removeStep = function(tabId, index, callback) {
        var steps = tabs[tabId] && tabs[tabId].steps;
        if (steps) {
            steps.splice(index, 1);
        }
        callback(steps);
    };

    Recorder.prototype.removeSteps = function(tabId, callback) {
        this.stopRecording(tabId);
        delete tabs[tabId];
        callback();
    };

    Recorder.prototype.updateCounter = function(tabId) {
        if (this.isRecording(tabId)) {
            Icon.setBadgeCounter(tabId, tabs[tabId].steps.length + 1);
        }
    };

    Recorder.prototype.isRecording = function(tabId) {
        return !!tabs[tabId];
    };

    Recorder.prototype.loadStorage = function(callback) {
        var opts = {
            show_notifications: true,
            notification_timeout: 3,
            close_popup_on_leave: true,
            capture_hover_events: true,
            step_delay: 2,
            case_name : '',
            methods: [
                // 'title',
                'contain.text',
                'value.equal',
                'have.style',
                'have.text',
                'have.htmlClass',
                'have.attribute',
                'be.disable',
                'be.visible',
                'match',
                'not.contain.text',
                'not.value.equal',
                'not.have.style',
                'not.have.text',
                'not.have.htmlClass',
                'not.have.attribute',
                'not.be.disable',
                'not.be.visible',
                'not.match'
            ]
        };

        chrome.storage.sync.get(null, function(items) {
            for (var attr in items) {
                opts[attr] = items[attr];
            }

            callback(opts);
        });
    };

    Recorder.prototype.saveStorage = function(items, callback) {
        chrome.storage.sync.set(items, callback);
    };

    return Recorder;
})();

window.recorder = new Recorder();

window.recorder.loadStorage(function(items) {
    window.options = items;
});

var Icon = (function() {
    return {
        turnOff: function(tabId) {
            chrome.browserAction.setIcon({ path: {'38': 'images/icon-black-38.png' }, tabId: tabId });
            chrome.browserAction.setBadgeText({ text: '0', tabId: tabId });
        },

        turnOn: function(tabId) {
            chrome.browserAction.setIcon({ path: {'38': 'images/icon-green-38.png' }, tabId: tabId });
        },

        setBadgeCounter: function(tabId, value) {
            var text = value ? "" + value : "";
            chrome.browserAction.setBadgeText({ text: text, tabId: tabId });
        }
    };
})();

var Notifier = (function() {
    function show(id, title, message, timeout) {
        try{
            var notification = chrome.notifications.create(id, {
                type: "basic",
                iconUrl: "images/icon-green.png",
                title: title,
                message: message
            }, function () {
                
            });
            // window.setTimeout((function(id){
            //     chrome.notifications.clear(id);
            // })(notification), 1000);
        }catch(e){
            console.log("通知异常" + e);
        }
    }

    return {
        show: function(tabId, data) {
            show(tabId, 'Event: ' + data.command, 'Selector: ' + data.selector);
        }
    };
})();