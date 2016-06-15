'use strict';

app.factory('Recorder', function($rootScope) {
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
});