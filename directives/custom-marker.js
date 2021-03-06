/**
 * @ngdoc directive
 * @memberof ngmap
 * @name custom-marker
 * @param Attr2Options {service} convert html attribute to Gogole map api options
 * @description
 *   Marker with html
 *   Requires:  map directive
 *   Restrict To:  Element
 *
 * @attr {String} position required, position on map
 * @attr {Number} z-index optional
 * @attr {Boolean} visible optional
 * @example
 *
 * Example:
 *   <map center="41.850033,-87.6500523" zoom="3">
 *     <custom-marker position="41.850033,-87.6500523" offset-x="12" offset-y="16">
 *       <div>
 *         <b>Home</b>
 *       </div>
 *     </custom-marker>
 *   </map>
 *
 */
/* global document */
(function () {
    'use strict';
    var parser, NgMap;

    var CustomMarker = function (options) {
        options = options || {};

        this.el = document.createElement('div');
        this.el.style.display = 'inline-block';
        this.el.style.visibility = "hidden";
        this.visible = true;
        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                this[key] = options[key];
            }
        }
    };

    var setCustomMarker = function () {

        CustomMarker.prototype = new google.maps.OverlayView();

        CustomMarker.prototype.setContent = function (html) {
            this.el.innerHTML = html;
            this.el.style.position = 'absolute';
        };

        CustomMarker.prototype.getDraggable = function () {
            return this.draggable;
        };

        CustomMarker.prototype.setDraggable = function (draggable) {
            this.draggable = draggable;
        };

        CustomMarker.prototype.getPosition = function () {
            return this.position;
        };

        CustomMarker.prototype.setPosition = function (position) {
            position && (this.position = position);
            /* jshint ignore:line */
            var _this = this;
            if (this.getProjection() && typeof this.position.lng == 'function') {
                var setPosition = function () {
                    if (!_this.getProjection() || typeof _this.position.lng !== 'function') {
                        return;
                    }
                    var offsetX = _this.hasOwnProperty('offsetX') ? _this.offsetX : 0;
                    var offsetY = _this.hasOwnProperty('offsetY') ? _this.offsetY : 0;
                    var posPixel = _this.getProjection().fromLatLngToDivPixel(_this.position);
                    var x = Math.round(posPixel.x - offsetX);
                    var y = Math.round(posPixel.y - offsetY);
                    _this.el.style.left = x + "px";
                    _this.el.style.top = y + "px";
                    _this.el.style.visibility = "visible";
                };
                if (_this.el.offsetWidth && _this.el.offsetHeight) {
                    setPosition();
                } else {
                    //delayed left/top calculation when width/height are not set instantly
                    setTimeout(setPosition, 300);
                }
            }
        };

        CustomMarker.prototype.setZIndex = function (zIndex) {
            zIndex && (this.zIndex = zIndex);
            /* jshint ignore:line */
            this.el.style.zIndex = this.zIndex;
        };

        CustomMarker.prototype.getVisible = function () {
            return this.visible;
        };

        CustomMarker.prototype.setVisible = function (visible) {
            this.el.style.display = visible ? 'inline-block' : 'none';
            this.visible = visible;
        };

        CustomMarker.prototype.addClass = function (className) {
            var classNames = this.el.className.trim().split(' ');
            (classNames.indexOf(className) == -1) && classNames.push(className);
            /* jshint ignore:line */
            this.el.className = classNames.join(' ');
        };

        CustomMarker.prototype.removeClass = function (className) {
            var classNames = this.el.className.split(' ');
            var index = classNames.indexOf(className);
            (index > -1) && classNames.splice(index, 1);
            /* jshint ignore:line */
            this.el.className = classNames.join(' ');
        };

        CustomMarker.prototype.onAdd = function () {
            this.getPanes().overlayMouseTarget.appendChild(this.el);
        };

        CustomMarker.prototype.draw = function () {
            this.setPosition();
            this.setZIndex(this.zIndex);
            this.setVisible(this.visible);
        };

        CustomMarker.prototype.onRemove = function () {
            this.el.parentNode.removeChild(this.el);
        };
    };

    var linkFunc = function (orgHtml, varsToWatch) {

        return function (scope, element, attrs, mapController) {
            mapController = mapController[0] || mapController[1];
            var orgAttrs = parser.orgAttributes(element);

            var filtered = parser.filter(attrs);
            var options = parser.getOptions(filtered, { scope: scope });
            var events = parser.getEvents(scope, filtered);

            element[0].style.display = 'none';
            console.log("custom-marker options", options);
            var customMarker = new CustomMarker(options);

            if (varsToWatch && varsToWatch.length > 0) {
                scope.$watch('[' + varsToWatch.join(',') + ']', function () {
                    customMarker.setContent(orgHtml);
                });
            }

            setTimeout(function () {
                customMarker.setContent(element[0].innerHTML);
                var classNames = element[0].firstElementChild.className;
                customMarker.addClass('custom-marker');
                customMarker.addClass(classNames);
                console.log('customMarker', customMarker, 'classNames', classNames);

                if (!(options.position instanceof google.maps.LatLng)) {
                    NgMap.getGeoLocation(options.position).then(
                        function (latlng) {
                            customMarker.setPosition(latlng);
                        }
                    );
                }
            }, 0);

            console.log("custom-marker events", "events");
            for (var eventName in events) {
                if (events.hasOwnProperty(eventName)) {
                    google.maps.event.addDomListener(customMarker.el, eventName, events[eventName]);
                }
            }
            mapController.addObject('customMarkers', customMarker);

            //set observers
            mapController.observeAttrSetObj(orgAttrs, attrs, customMarker);

            element.bind('$destroy', function () {
                //Is it required to remove event listeners when DOM is removed?
                mapController.deleteObject('customMarkers', customMarker);
            });

        }; // linkFunc
    };

    var customMarkerDirective = function ($interpolate, Attr2MapOptions, _NgMap_, escapeRegExp) {
        parser = Attr2MapOptions;
        NgMap = _NgMap_;

        var exprStartSymbol = $interpolate.startSymbol();
        var exprEndSymbol = $interpolate.endSymbol();
        var exprRegExp = new RegExp(escapeRegExp(exprStartSymbol) + '([^' + exprEndSymbol.substring(0, 1) + ']+)' + escapeRegExp(exprEndSymbol), 'g');

        return {
            restrict: 'E',
            require:  ['?^map', '?^ngMap'],
            compile:  function (element) {
                setCustomMarker();
                element[0].style.display = 'none';
                var orgHtml = element.html();
                var matches = orgHtml.match(exprRegExp);
                var varsToWatch = [];
                //filter out that contains '::', 'this.'
                (matches || []).forEach(function (match) {
                    var toWatch = match.replace(exprStartSymbol, '').replace(exprEndSymbol, '');
                    if (match.indexOf('::') == -1 &&
                        match.indexOf('this.') == -1 &&
                        varsToWatch.indexOf(toWatch) == -1) {
                        varsToWatch.push(match.replace(exprStartSymbol, '').replace(exprEndSymbol, ''));
                    }
                });

                return linkFunc(orgHtml, varsToWatch);
            }
        }; // return
    };// function
    customMarkerDirective.$inject =
        ['$interpolate', 'Attr2MapOptions', 'NgMap', 'escapeRegexpFilter'];

    angular.module('ngMap').directive('customMarker', customMarkerDirective);
})();
