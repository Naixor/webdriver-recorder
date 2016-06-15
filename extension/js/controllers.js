'use strict';

app.controller('OptionsController', function OptionsController($scope, Recorder) {
	Recorder.loadStorage(function(items) {
		$scope.options = items;
	});

	$scope.save = function() {
		Recorder.saveStorage($scope.options, function() {
			$scope.message = "保存成功";
		});
	};
});

app.controller('PopupController', function PopupController($scope, $http, Recorder) {
	$scope.options = [];
    $scope.uploadMessage = "";
	Recorder.loadStorage(function(items) {
		$scope.options = items;
        $scope.options.methods.unshift('');
	});

	Recorder.getTab(function(tab) {
		var url = tab.url || "";
		$scope.canRecord = $.inArray(url.split(':')[0], ["http", "https"]) !== -1;
	});

	$scope.refreshData = function() {
		Recorder.getData(function(data) {
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
	};

	$scope.refreshData();

	$scope.$watch('isRecording', function(value) {
		$scope.mainButtonClass = value ? "btn-warning" : "btn-success";
	});

	$scope.submitUrl = function() {
		return $scope.options.server + "/addCase";
	};

	$scope.clickMainButton = function() {
		if ($scope.isRecording) {
			$scope.uploadToBrowserbite();
		}
		else {
			$scope.startRecording();
		}
	};

	$scope.changeDelayAll = function() {
		angular.forEach($scope.data.steps, function(step) {
			step.delay = $scope.delayAll;
		});
	};

	$scope.changeCaptureAll = function() {
		angular.forEach($scope.data.steps, function(step) {
			step.capture = $scope.captureAll;
		});
	};

	$scope.startRecording = function() {
		Recorder.start($scope.refreshData);
		if ($scope.options.close_popup_on_leave) {
			Recorder.closePopupOnLeave();
		}
	};

	$scope.stopRecording = function() {
		Recorder.stop($scope.refreshData);
	};

	$scope.uploadToBrowserbite = function() {
        if (!$scope.data.case_name) {
            return ($scope.uploadMessage = 'CaseName cannot be empty!');
        }
        var code = builWebDriverCase($scope.data);
        if (code) {
            $http.post('http://localhost:8765', {
                name: $scope.data.case_name,
                code: code
            }).then(function success() {
                $scope.uploadMessage = 'Upload success!';
            }, function fail() {
                $scope.uploadMessage = 'Fail!';
            });
        }
	};

	$scope.removeStep = function(index) {
		Recorder.removeStep(index, $scope.refreshData);
	};

	$scope.removeSteps = function() {
		Recorder.removeSteps($scope.refreshData);
	};

	$scope.openOptions = function() {
		Recorder.openOptions();
	};
    
    $scope.getUploadMessageColor = function () {
        return $scope.uploadMessage === 'Upload success!' ? 'green' : 'red';
    };
    
    function builWebDriverCase(data) {
        var builder = new WebDriverCaseBuilder();
        builder.initUrl(data.initialUrl, data.base, 'localhost:3334').describeStart(data.case_name);
        var preIdx = 0;
        data.steps.forEach(function (step, i) {
            if (step.byMethod) {
                builder.it(data.steps.slice(preIdx, i + 1));
                preIdx = i + 1;
            }
        });
        if (preIdx === 0) {
            $scope.uploadMessage = 'Can not build case with no expect!';
            return "";
        }
        return builder.describeEnd().getCode();
    }
});

var WebDriverCaseBuilder = (function() {
    var Code = {
        init: function (url, proxy) {
            if (!proxy)  {
                return `var fs = require('fs');var webdriver = require('selenium-webdriver');var promise = require('selenium-webdriver/lib/promise');var driver = new webdriver.Builder().withCapabilities(webdriver.Capabilities.chrome()).build();var chai = require('chai');var chaiWebdriver = require('chai-webdriver');chai.use(chaiWebdriver(driver));var expect = chai.expect;var url = "${url}";`;
            }
            return `var fs = require('fs');var webdriver = require('selenium-webdriver');var promise = require('selenium-webdriver/lib/promise');var proxy = require('selenium-webdriver/proxy');var driver = new webdriver.Builder().withCapabilities(webdriver.Capabilities.chrome()).setProxy(proxy.manual({http: "${proxy}", https: "${proxy}"})).build();var chai = require('chai');var chaiWebdriver = require('chai-webdriver');chai.use(chaiWebdriver(driver));var expect = chai.expect;var url = "${url}";`;
        },
        describe: function(name, code) {
            return `describe("${name}", function() {this.timeout(60 * 1000);before(function (done) {start(url, done);});${code}after(function (done) {end(done);});});`;
        },
        expect: function (selector, byMethod, expectValue) {
            switch (byMethod) {
                case 'be.visible':
                case 'not.be.visible':
                    return `.then(function() {return new promise.Promise(function(reject){setTimeout(function(){expect('${selector}').dom.to.${byMethod}(reject);}, 1000)})}).then(done)`;
                default:
                    return `.then(function() {expect('${selector}').dom.to.${byMethod}(${expectValue});}).then(done)`; 
            }
        },
        it: function (name, code) {
            return `it('${name}', function (done) {${code}});`;
        },
        resize: function (width, height) {
            return `driver.manage().window().setSize(${width}, ${height})`;
        },
        addCookie: function (name, value) {
            return `driver.manage().addCookie('${name}', '${value}')`;
        },
        utils: function (base) {
            var addCookiesCode = "";
            cookieString2Array(base.cookie).forEach(function (cookieKv) {
                addCookiesCode += Code.addCookie(cookieKv.name, cookieKv.value) + ";";
            });
            var select = `function select(locator, optionLocator, timeout) {return ${Code.click('locator', 'timeout')}.then(function(){return ${Code.click('optionLocator', 'timeout')};});}`;
            return `function start(url, callback) {${Code.resize(base.width, base.height)};driver.get(url);${addCookiesCode};driver.get(url).then(callback);}function end(callback) {driver.switchTo().defaultContent();driver.executeScript("return window.__coverage__;").then(function (obj) {fs.writeFile('coverage/coverage.json', JSON.stringify(obj));return driver.quit();}, function fail(err) {console.log(err);driver.quit().then(callback);}).then(callback);}${select}`;
        },
        By: {
            css: function (css) {
                return `webdriver.By.css('${css}')`;
            },
            xpath: function (xpath) {
                return `webdriver.By.xpath('${xpath}')`;
            }
        },
        findElement: function (locator) {
            return `driver.findElement(${locator})`;
        },
        waitFor: function (locator, time) {
            return `driver.wait(webdriver.until.elementLocated(${locator}), ${time})`;
        },
        click: function (locator, timeout) {
            return `${Code.waitFor(locator, timeout)}.click()`;
        },
        scroll: function (element, scrollLeft, scrollTop) {
            return `driver.executeScript("document.querySelector('${element}').scrollLeft = ${scrollLeft || 0};document.querySelector('${element}').scrollTop = ${scrollTop || 0}")`;
        },
        select: function (selector, selectIdx, timeout) {
            var method = cssOrXpath(selector);
            return `select(${Code.By[method](selector)}, ${Code.By[method](getChildOptionPath(selector, selectIdx))}, ${timeout || 0})`;
        },
        sendKeys: function (locator, keys, timeout) {
            return `${Code.waitFor(locator, timeout || 0)}.sendKeys(${keys})`;
        },
        hover: function (hoverCmdArr, byIdx) {
            if (hoverCmdArr && hoverCmdArr.length) {
                return hoverCmdArr.map(function (hover) {
                    var ele = byIdx ? Code.By.xpath(hover.xpathByIdx) : Code.By.css(hover.selector);
                    return `${Code.findElement(ele)}.then(function(elem){driver.actions().mouseMove(elem).perform();driver.sleep(500)})`;
                }).join(';');
            } else {
                return '';
            }
        },
        tap(locator, timeout) {
            return `${Code.waitFor(locator, timeout)}.then(function(ele){driver.touchActions().tap(ele).perform()})`;
        }
    };
    function cookieString2Array(cookieStr) {
        return cookieStr.split(';').map(function (str) {
            var kv = str.split('=');
            return {
                name: kv[0],
                value: kv[1]
            };
        });
    }
    function cssOrXpath(selector) {
        return !~selector.indexOf('\/') ? 'css' : 'xpath';
    }
    function getChildOptionPath(selector, idx) {
        if (cssOrXpath(selector) === 'css') {
            return `${selector} > option:nth-child(${idx})`;
        }
        return `${selector}/option[${idx}]`;
    }
    
    var describeName = "";
    var describeCode = "";
    var code = "";
    var WebDriverCaseBuilder = function () {};
    WebDriverCaseBuilder.prototype.getCode = function () {
        var _code = code;
        code = "";
        return _code;
    };
    WebDriverCaseBuilder.prototype.initUrl = function (url, base, proxy) {
        code += Code.init(url, proxy);
        code += Code.utils(base);
        return this;
    };
    WebDriverCaseBuilder.prototype.describeStart = function (caseName) {
        this.describe = function () {
            throw new Error("Describe should be call once!");
        };
        describeName = caseName;
        return this;
    };
    WebDriverCaseBuilder.prototype.describeEnd = function () {
        code += Code.describe(describeName, describeCode);
        describeName = "";
        describeCode = "";
        return this;
    };
    WebDriverCaseBuilder.prototype.it = function (steps) {
        var length = steps.length;
        if (!steps || !length) {
            return this;
        }
        var byMethod = steps[length-1].byMethod;
        var eleXpath = steps[length-1].xpath;
        var eleSelector = steps[length-1].byIdx ? steps[length-1].selectorByIdx : steps[length-1].selector;
        var expectValue = steps[length-1].expect;
        var meta = steps[length-1].meta;
        var name = `${byMethod} ${eleXpath || eleSelector}`;

        var _code;
        if (length === 1) {
            var step = steps[0];
            var eleLocator;
            var timeout = (step.delay * 1000) || 2000;
            if (step.byIdx) {
                eleLocator = Code.By.xpath(step.xpathByIdx);
            } else if (step.xpath) {
                eleLocator = Code.By.xpath(step.xpath);                    
            } else {
                eleLocator = Code.By.css(step.selector);
            }
            _code = Code.hover(step.meta.hover) + ';' + Code.waitFor(eleLocator, timeout);
        } else {
            _code = steps.slice(0, length - 1).map(function (step) {
                var eleLocator;
                var timeout = (step.delay * 1000) || 2000;
                if (step.byIdx) {
                    eleLocator = Code.By.xpath(step.xpathByIdx);
                } else if (step.xpath) {
                    eleLocator = Code.By.xpath(step.xpath);                    
                } else {
                    eleLocator = Code.By.css(step.selector);
                }
                var hover = Code.hover(step.meta.hover, step.byIdx);
                var cmdCode = '';
                switch(step.command) {
                    case 'check':
                    case 'uncheck':
                    case 'click':
                        cmdCode = Code.click(eleLocator, timeout);
                        break;
                    case 'tap':
                        cmdCode = Code.tap(eleLocator, timeout);
                        break;
                    case 'scroll':
                        cmdCode = Code.scroll(step.selector, step.meta.scrollLeft, step.meta.scrollTop);
                        break;
                    case 'resize':
                        cmdCode = Code.resize(step.meta.width, step.meta.height);
                        break;
                    case 'select':
                        cmdCode = Code.select(step.selector, step.data, timeout);
                        break;
                    case 'fill_in':
                        cmdCode = Code.sendKeys(eleLocator, step.data, timeout);
                        break;
                }
                return `${hover}${hover ? ';' : ''}${cmdCode}`;
            }).join(';');
        }
        var lastOneHover = Code.hover(meta.hover);
        lastOneHover = lastOneHover ? `;${lastOneHover}` : '';
        describeCode += Code.it(name, _code + lastOneHover + Code.expect(eleSelector, byMethod, expectValue));

        return this;
    };
    
    return WebDriverCaseBuilder;
})();

var WebDriverMvpCaseBuilder = (function() {
    var Code = {
        
    };
})();