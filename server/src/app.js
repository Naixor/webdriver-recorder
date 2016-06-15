const coverage_dir = 'caverage';
const spec_dir = 'spec';
const src_dir = 'src';
const grunt_file = 'Gruntfile.js';
const package_file = 'package.json';
const SET_FOLDER = 'SET_FOLDER';
const START_PROXY = 'START_PROXY';
const INIT_ENV = 'INIT_ENV';
const CHECK_ENV = 'CHECK_ENV';

angular.module('App', []).controller('mainController', ['$scope', function ($scope) {
    const remote = require('remote');
    const dialog = remote.require('dialog');
    const ipcRenderer = require('electron').ipcRenderer;
    
    ipcRenderer.on('asynchronous-reply', (event, arg) => {
        console.log(arg);
        switch (arg) {
            case 'HAS_INIT_ENV':
                $scope.envHasInit = true;
                break;
        } 
    });

    $scope.folderPath = "";
    $scope.envHasInit = true;

    $scope.openFolder = function () {
        $scope.folderPath = dialog.showOpenDialog({
            title: 'Open Your Case Folder',
            defaultPath: $scope.folderPath,
            filters: [],
            properties: ['openDirectory']
        }) || "";
        if ($scope.folderPath.length) {
            ipcRenderer.send('asynchronous-message', JSON.stringify({type: SET_FOLDER, data: {folderPath: $scope.folderPath[0]}}));
            checkEnv();
        }
    };
    
    $scope.printFolderPath = function () {
        return $scope.folderPath.length ? $scope.folderPath[0] : "";
    };
    
    $scope.isPhone = false;
    
    $scope.startProxy = function () {
        ipcRenderer.send('asynchronous-message', JSON.stringify({type: START_PROXY, data: {isPhone: $scope.isPhone}}));
    };
    
    $scope.initEnv = function () {
        ipcRenderer.send('asynchronous-message', JSON.stringify({type: INIT_ENV, data: {}}));
    };
    
    function checkEnv() {
        return ipcRenderer.send('asynchronous-message', JSON.stringify({type: CHECK_ENV, data: {}}));        
    }
}]);