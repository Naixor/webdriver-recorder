if (!window.browserbiteRecorder) {

(function() {
	'use strict';

	window.browserbiteRecorder = {};
	var timestamp = 0;

	var DomHelper = (function() {

		var getNodeIndex = function(elem) {
			var children = elem.parentNode.childNodes;
			var total = 0;
			for (var i = 0; i < children.length; i++) {
				var child = children[i];

				if (child.nodeName == elem.nodeName) {
					total++;
					if (child == elem)
						return total;
				}
			}
			return -1;
		};

		function stringInsert(str, index, string) {
			if (index > 0)
				return str.substring(0, index) + string + str.substring(index, str.length);
			else if (index < 0)
				return str + string;
			else
				return string + str;
		}
		
		function notLetterToHexCode(str) {
			return str.replace(/[0-9]/g, function (match) {
				return '\\\\' + (match.charCodeAt(0).toString(16));
			});
		}

		var getIndexSelector = function(elem) {
			var idx = getNodeIndex(elem);
			return idx > 1 ? ':nth-of-type(' + idx + ')' : '';
		};

		var getElementData = function(elem) {
			var data = {
				tag: elem.nodeName.toLowerCase()
			};

			if (data.tag == 'a') {
				var attrs = ['href', 'name', 'type', 'alt', 'title', 'value'];
				for (var i = 0; i < attrs.length; i++) {
					var attr = attrs[i];
					var val = elem.getAttribute(attr);
					if (val)
						data[attr] = val;
				}

				if (elem.textContent)
					data.text = elem.textContent;
			}

			if (elem.id)
				data.id = elem.id;

			if (elem.className.trim())
				data.classes = elem.className.split(/\s+/);

			return data;
		};

		var getElementDomPath = function(elem) {
			if (!elem.parentElement || elem.parentElement.nodeName.toLowerCase() == 'html')
				return [getElementData(elem)];
			else
				return [getElementData(elem)].concat(getElementDomPath(elem.parentElement));
		};

		var getElementSelector = function(elem) {
            switch (elem) {
                case document: return "document";
                case window: return "window";
            }
            if (!elem.nodeName) {
                return "";
            }
 			var attrs = ['id', 'name', 'class', 'type', 'alt', 'title', 'value'];
			var selector = elem.nodeName.toLowerCase();
			for (var i = 0; i < attrs.length; i++) {
				var attr = attrs[i];
				var val = elem.getAttribute(attr);
				if (!val) { continue; }

				if(attr == 'id'){ 
					selector = '#' + notLetterToHexCode(val.replace('.', "\\."));
				}//只显示第一个class
				else if (attr == 'class') {
					//selector = selector + '.' + val.trim().replace(/\s+/g, '.');

					//过滤angular的 class
					var class_arr = val.trim().split(/\s+/).filter(function(name){
						return !/^(ng\-|active)/.test(name);
					});
					if(class_arr.length){
						selector = selector + '.' + class_arr.shift();
					}
				}else{
					selector = selector + '[' + attr + '="' + val + '"]';
				}
				break;
			}

			return selector;
		};

		var testXPath = function(element, path) {
			if (typeof(path) === 'object' && path.length) {
				path = "/" + path.join("/");
			}

			var res = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
			return res.singleNodeValue == element;
		};

		
		/**
		 * 获取元素xpath
		 * @param  {Node} element
		 * @param  {boolean} byIdx 如果为true,则返回的xpath为纯节点位置类型,如: html/body/div[2]/div[3]/div[1]/div[2] 
		 * @returns null
		 */
		var getElementXPath = function(element, byIdx) {
			var paths = [];
			var originalElement = element;
			
			if (byIdx) {
				var idx;
				for (; element && (element.nodeType === 1); element = element.parentNode) {
					idx = 0;
					for (var ele, i = 0; (ele = element.childNodes[i]); i++) {
						if (ele.tagName === originalElement.tagName) {
							idx++;
						}
						if (ele === originalElement) {
							paths.unshift(originalElement.tagName+ '['+ idx +']');
							break;
						}
					}
					originalElement = element;
				}
				paths.unshift('html');
			} else {
				// Use nodeName (instead of localName) so namespace prefix is included (if any).
				for (; element && element.nodeType == 1; element = element.parentNode)  {
					// EXTRA TEST FOR ELEMENT.ID
					if (element && element.id) {
						paths.unshift('/*[@id="' + element.id + '"]');
						if (testXPath(originalElement, paths)) {
							break;
						}
						else {
							paths.splice(0, 1);
						}
					}

					var index = 0;
					for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
						// Ignore document type declaration.
						if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) {
							continue;
						}

						if (sibling.nodeName == element.nodeName) {
							++index;
						}
					}

					var tagName = element.nodeName.toLowerCase();
					var pathIndex = (index ? "[" + (index+1) + "]" : "");
					paths.splice(0, 0, tagName + pathIndex);
				}
			}

			return paths.length ? "/" + paths.join("/") : null;
		};

		return {
			getLinkTextAndHref: function(elem) {
				var text;
				var current = elem;
				while (current.nodeName.toLowerCase() != 'html') {
					if (current.nodeName.toLowerCase() == 'a')
						return [current.textContent, current.href];
					current = current.parentNode;
				}
				return null;
			},

			getSubPath: function(elem, byIdx) {
				var current = elem;
				var path = byIdx ? current.nodeName.toLowerCase() : getElementSelector(elem);
                if (path === "window" || path === "document") {
                    return path;
                }
				while (document.querySelector(path) != elem && current.nodeName.toLowerCase() != 'html') {
					var idx = getNodeIndex(current);
					if (idx > 1) {
						path = stringInsert(path, path.indexOf(' >'), ':nth-of-type(' + idx + ')');
						if (document.querySelector(path) == elem)
							return path;
					}

					path = (byIdx ? current.parentNode.nodeName.toLowerCase() : getElementSelector(current.parentNode)) + ' > ' + path;
					current = current.parentNode;
				}
				return path;
			},

			getXPath: getElementXPath,

			getPathArray: getElementDomPath,

			supportsChangeEvent: function(elem) {
				var tag = elem.nodeName.toLowerCase();
				if (tag == 'input') {
					var type = elem.getAttribute('type');
					if (type == 'text') return true;
					if (type == 'radio') return true;
					if (type == 'checkbox') return true;
					if (type == 'password') return true;
				}
				else if (tag == 'textarea') return true;
				else if (tag == 'select') return true;

				return false;
			},

			ignoreElement: function(elem) {
				var tag = elem.nodeName && elem.nodeName.toLowerCase();
				if (tag == "input")
					if (elem.getAttribute("type") == "file")
						return true;

				if (tag == "html" || tag == "body")
					return true;

				return false;
			},

			getChangeData: function(elem) {
				var tag = elem.nodeName.toLowerCase();

				var cmd = 'fill_in';
				var val = elem.value;

				if (tag == 'input') {
					var type = elem.getAttribute('type');
					if (type == 'checkbox' || type == 'radio')
						return {
							command: elem.checked ? 'check' : 'uncheck'
						};
				}
				else if (tag == 'select') {
					var opts = elem.options;
					var selected = 0;
					for(var i = 0; i < opts.length; i++) {
						if (opts[i].selected)
							selected = i + 1;
					}

					return {
						command: 'select',
						data: selected
					};
				}

				// textarea, input[type=text|password]
				return {
					command: cmd,
					form : getElementSelector(elem.form),
					data: [elem.value]
				};
			},
			
			isMobile() {
				return navigator.userAgent.indexOf("Mobile") > -1;
			}
		};
	})(); // DomHelper

	window.browserbiteRecorder.domHelper = DomHelper;

	function clickListener(e) {
		if (DomHelper.ignoreElement(e.target))
			return;

		if (DomHelper.supportsChangeEvent(e.target))
			return;
		var current_time = +new Date();
		if(current_time - timestamp < 300){
			console.log("ignore,already record");
			return;
		}else{
			timestamp = current_time;
		}
		//touch事件可能拿不到鼠标位置，则改为target的中间位置
		var rect = e.target.getBoundingClientRect();
		var message = {
			command: e.type === 'click' ? 'click' : 'tap',
			selector: DomHelper.getSubPath(e.target),
			selectorByIdx: DomHelper.getSubPath(e.target, true),
			xpath: DomHelper.getXPath(e.target),
			xpathByIdx: DomHelper.getXPath(e.target, true),
			meta: {
				x: e.pageX || (e.touches ? e.touches[0].pageX : (rect.left + rect.width/2)),
				y: e.pageY || (e.touches ? e.touches[0].pageY : (rect.top + rect.height/2)),
				scrollTop: window.pageYOffset,//获取页面文档位置
				targetLeft: e.target.offsetLeft,
				targetTop: e.target.offsetTop,
				targetWidth: e.target.offsetWidth,
				targetHeight: e.target.offsetHeight
			}
		};

		var link = DomHelper.getLinkTextAndHref(e.target);
		if (link) {
			message.link = link[0];
			message.href = link[1];
		}

		//message.capture = !!link;
		message.capture = true;

		message.meta.hover = mouseenterQueue.slice();
		mouseenterQueue.length = 0;

		//移动端由于优先侦听 touch 时间，比change 事件早，可能导致表单填写时顺序错乱
		//延迟200ms发送数据
		if(DomHelper.isMobile()){
			setTimeout(function(){
				sendMessage(message);
			},100);
		}else{
			sendMessage(message);
		}
	}

	function changeListener(e) {
		console.log("changeListener");
		if (DomHelper.ignoreElement(e.target))
			return;

		var data = DomHelper.getChangeData(e.target);

		var message = {
			command: data.command,
			selector: DomHelper.getSubPath(e.target),
			selectorByIdx: DomHelper.getSubPath(e.target, true),
			xpath: DomHelper.getXPath(e.target),
			xpathByIdx: DomHelper.getXPath(e.target, true),
			data: data.data,
			form: data.form || "",
			meta: {
				targetLeft: e.target.offsetLeft,
				targetTop: e.target.offsetTop,
				targetWidth: e.target.offsetWidth,
				targetHeight: e.target.offsetHeight
			}
		};

		sendMessage(message);
	}

	var mouseenterQueue = [];
	function mouseenterListener(e) {
		var data = {
			selector: DomHelper.getSubPath(e.target),
			xpath: DomHelper.getXPath(e.target),
			xpathByIdx: DomHelper.getXPath(e.target, true),
		};

		while (mouseenterQueue.length >= 10) {
			mouseenterQueue.shift();
		}
		mouseenterQueue.push(data);
	}
    
    var resizeTimer = 0;
    function resizeListener(e) {
        clearTimeout(resizeTimer);
        // 两秒后判断用户是否还在更改窗口大小
        resizeTimer = setTimeout(function () {
            var message = {
                command: 'resize',
                selector: 'window',
                xpath: 'window',
                meta: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };
            sendMessage(message);
            console.log('resize');
        }, 1000);
    }
    
    var scrollTimer = 0;
    function scrollListener(e) {
        clearTimeout(scrollTimer);
        // 两秒后判断用户是否还在滚动
        scrollTimer = setTimeout((function (e) {
            return function () {
                console.log('scrollEvent:', e);
                if (DomHelper.ignoreElement(e.target))
                    return;
                var selector = DomHelper.getSubPath(e.target);
                var xpath = DomHelper.getXPath(e.target);
                if (selector === 'document') {
                    selector = 'body';
                    xpath = '/html/body';
                } 

                var meta = {
					scrollTop: e.target.scrollTop || document.scrollingElement.scrollTop,
					scrollLeft: e.target.scrollLeft || document.scrollingElement.scrollLeft 
				};

                var message = {
                    command: 'scroll',
                    selector: selector,
                    xpath: xpath,
					xpathByIdx: DomHelper.getXPath(e.target, true),
                    meta: meta
                };
                sendMessage(message);
                console.log('scroll');
            };
        })(e), 1000);
    }

	function addEventListeners() {
		if (window.browserbiteRecorder.isRecording) {
			return;
		}

		window.browserbiteRecorder.isRecording = true;
		if(DomHelper.isMobile()){
			//移动端需同时考虑tap和click事件，tap优先
			document.addEventListener('touchstart', clickListener, true);
			document.addEventListener('click', clickListener, true);
		}else{
			document.addEventListener('click', clickListener, true);
            window.addEventListener('resize', resizeListener, true);
			document.addEventListener('mouseover', mouseenterListener, true);
		}
        window.addEventListener('scroll', scrollListener, true);
		document.addEventListener('change', changeListener, true);
	}

	function removeEventListeners() {
		if (!window.browserbiteRecorder.isRecording) {
			return;
		}

		window.browserbiteRecorder.isRecording = false;
		document.removeEventListener('click', clickListener, true);
		document.removeEventListener('touchstart', clickListener, true);
		document.removeEventListener('change', changeListener, true);
		document.removeEventListener('mouseover', mouseenterListener, true);
        window.removeEventListener('resize', resizeListener, true);
        window.removeEventListener('scroll', scrollListener, true);
		console.log("event listeners removed.");
	}

	var sendMessage = function(msg) {
		chrome.runtime.sendMessage(msg);
	};

	if (chrome.extension) {

	chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        console.log('receive message', msg);
		if (msg.startRecording) {
			addEventListeners();

			//初始化消息，主要为设备信息
			var init_msg = {
				'userAgent' : navigator.userAgent,
				'width'  :  window.screen.width,
				'height' :  window.screen.height
			};
			sendMessage(init_msg);
			sendResponse(true);
		} else {
            removeEventListeners();
			sendResponse(false);
        }

		// Returning true will keep the message channel open to the other end until sendResponse is called.
		return true;
	});

	chrome.runtime.sendMessage({ getOptions: true }, function(response) {
		window.browserbiteRecorder.options = response;
	});

	}


	//遍历所有超链接将a标签修改为当前tab打开
	for(var i=0; i < document.links.length; i++){
		var target =  document.links[i].target;
		if(target == "_blank" || target == "view_window"){
			document.links[i].target = "_self";
		}
	}

	addEventListeners();
})();

}
