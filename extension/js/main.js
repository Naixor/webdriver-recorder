(function (angular) {
    var app = angular.module('WebdriverRecorder', ['ngMaterial']);
    app.controller('mainCtrl', ['$scope',
                                'caseFactory',
                                'ExtensionID',
                                'iconService',
                                'CaseRecorder',
    function ($scope, caseFactory, ExtensionID, iconService, CaseRecorder) {
        $scope.canRecord = true;
        $scope.isRecording = false;
        $scope.recordStart = function () {
            $scope.isRecording = true;
            CaseRecorder.start($scope.refreshData);
            if ($scope.options.close_popup_on_leave) {
                CaseRecorder.closePopupOnLeave();                
            }
        };
        $scope.recordStop = function () {
            $scope.isRecording = false;
            CaseRecorder.stop($scope.refreshData);    
        };
        
        $scope.State = function () {
            return $scope.isRecording ? 'record' : 'stop';
        };

        $scope.recordBtnClick = function () {
            if (!$scope.isRecording) {
                $scope.recordStart();
            } else {
                $scope.recordStop();
            }
            // chrome.runtime.sendMessage(ExtensionID, {
            //     recordState: $scope.State()
            // });
        };
        $scope.case = caseFactory();
        
        $scope.options = [];
        CaseRecorder.loadStorage(function (items) {
            $scope.options = items;
        });
        
        CaseRecorder.getTab(function(tab) {
            var url = tab.url || "";
            $scope.canRecord = ["http", "https"].indexOf(url.split(':')[0]) !== -1;
        });
        
        $scope.refreshData = function () {
            CaseRecorder.getData(function(data) {
                if (data) {
                    $scope.isRecording = data.isRecording;
                    $scope.data = data;
                    $scope.showOptions = function() {
                        return $scope.data.show_advanced_options && !!$scope.data.steps;
                    };
                }
                else {
                    $scope.isRecording = false;
                    delete $scope.data;
                }
            });
            iconService.setState($scope.State());
            iconService.switch();
        };
        
        $scope.removeStep = function(index) {
            CaseRecorder.removeStep(index, $scope.refreshData);
        };

        $scope.removeSteps = function() {
            CaseRecorder.removeSteps($scope.refreshData);
        };
        
        $scope.saveToDisk = function () {
            window.webkitRequestFileSystem();
        };

        $scope.refreshData();
    }]);
    
    app.constant('ExtensionID', 'bblgfgpmfmniboijiihghdepfpjnhnoe');
    
    app.factory('CaseRecorder', ['$rootScope', function($rootScope) {
        function getActiveTab(callback) {
            chrome.tabs.query({ currentWindow: true, active: true }, function(activeTabs) {
                callback(activeTabs[0]);			
            });
        }

        function getBackgroundPage(callback) {
            chrome.runtime.getBackgroundPage(function(page) {
                callback(page);
            });
        }

        function getRecorder(callback) {
            getBackgroundPage(function(page) {
                callback(page && page.recorder);
            });
        }

        function getTabAndRecorder(callback) {
            getRecorder(function(recorder) {
                getActiveTab(function(tab) {
                    callback(tab, recorder);
                });
            });
        }

        function apply(callback) {
            return function() {
                var args = arguments;
                $rootScope.$apply(function() {
                    callback.apply(null, args);
                });
            };
        }

        return {
            getTab: function(callback) {
                getActiveTab(apply(callback));
            },

            getData: function(callback) {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.getData(tab.id, apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            start: function(callback) {
                getTabAndRecorder(function(tab, recorder) {
                    console.log('recorder: ', recorder);
                    if (recorder) {
                        recorder.startRecording(tab, apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            stop: function(callback) {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.stopRecording(tab.id, apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            removeStep: function(index, callback) {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.removeStep(tab.id, index, apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            removeSteps: function(callback) {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.removeSteps(tab.id, apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            isRecording: function() {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.isRecording(tab.id);
                    }
                });
            },

            closePopupOnLeave: function() {
                $('body').one('mouseleave', function() {
                    window.setTimeout(function() {
                        window.close();
                    }, 1000);
                });
            },

            loadStorage: function(callback) {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.loadStorage(apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            saveStorage: function(items, callback) {
                getTabAndRecorder(function(tab, recorder) {
                    if (recorder) {
                        recorder.saveStorage(items, apply(callback));
                    }
                    else {
                        apply(callback);
                    }
                });
            },

            openOptions: function() {
                chrome.tabs.create({
                    url: chrome.extension.getURL('options.html')
                });
            }
        };
    }]);
    
    app.service('iconService', function () {
        var state = 'stop';
        this.setState = function (_state) {
            state = _state;
        };
        this.switch = function () {
            if (state === "record") return chrome.browserAction.setIcon({path: 'images/icon-green.png'});
            if (state === "stop") return chrome.browserAction.setIcon({path: 'images/icon-black.png'});
        };
    });
    
    app.factory('caseFactory', function () {
        return function () {
            return {
                descriptName: '',
                it: []
            };
        };
    });
})(angular);