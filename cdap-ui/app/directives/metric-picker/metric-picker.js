/*
 * Copyright © 2015 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

angular.module(PKG.name + '.commons')
  .directive('myMetricPicker', function (MyDataSource, $stateParams, $log, MyMetricsQueryHelper, myHelpers) {

    var dSrc = new MyDataSource();
    var addAllOptionId = 'allMetricsAsWidgets';
    var addAllOptionLabel = 'Add all metrics as individual widgets';

    function MetricPickerCtrl ($scope) {

      var ns = [$stateParams.namespace,'namespace'].join(' ');

      $scope.metricsSettings = {
        externalProp: ''
      };
      
      $scope.available = {
        contexts: [],
        types: ['system', ns],
        names: []
      };

      $scope.metric = {
        context: '',
        type: ns,
        names: [{name: ''}],
        resetNames: function() {
          this.names = [{name: ''}];
        },
        getNames: function() {
          return this.names.map(function(value) {
            return value.name;
          });
        },
        getName: function() {
          return this.getNames().join(', ');
        }
      };

      $scope.addMetricName = function() {
        $scope.metric.names.push({name: ''});
      };

      $scope.deleteMetric = function(idx) {
        if ($scope.metric.names.length === 1) {
          // If its the only metric, simply clear it instead of removing it
          $scope.metric.resetNames();
        } else {
          $scope.metric.names.splice(idx, 1);
        }
      };

    }

    return {
      restrict: 'E',

      require: 'ngModel',

      scope: {
        metricsLimit: '=',
        metricsSlotsFilled: '='
      },

      templateUrl: 'metric-picker/metric-picker.html',

      controller: MetricPickerCtrl,

      link: function (scope, elem, attr, ngModel) {

        if(attr.required!==undefined) {
          elem.find('input').attr('required', true);
          // TODO: if the validators fail, propagate this information to the user
          ngModel.$validators.metricAndContext = function (m, v) {
            var t = m || v;
            // Metrics context requires an even number of parts
            if (t.context && t.context.split('.').length % 2 !== 0) {
              return false;
            }

            if (!t || !t.names || !t.names.length) {
              return false;
            }
            for (var i = 0; i < t.names.length; i++) {
              if (!t.names[i].length) {
                return false;
              }
            }
            return true;
          };

          ngModel.$validators.metricsLimitValidation = function() {
            var availableMetricSlots = scope.metricsLimit - scope.metricsSlotsFilled;
            var hasMetricsLimitReached = myHelpers.objectQuery(scope, 'metric', 'names', 0, 'name', 'id') === addAllOptionId &&  availableMetricSlots < scope.available.names.length;
            if (hasMetricsLimitReached) {
              return false;
            }
            return true;
          };

        }

        function getBaseContext () {
          var output;

          if(scope.metric.type==='system') {
            output = 'system';
          }
          else {
            output = $stateParams.namespace;

            if(!output) { // should never happen, except on directive playground
              output = 'default';
              $log.warn('metric-picker using default namespace as context');
            }

          }

          return 'namespace.' + output;
        }

        function fetchAhead () {
          var context = getBaseContext(),
              bLen = context.length + 1;

          if(scope.metric.context) {
            context += '.' + scope.metric.context;
          }
          var parts = context.split('.');
          if (parts.length % 2 !== 0) {
            return;
          }

          var tagQueryParams = MyMetricsQueryHelper.tagsToParams(MyMetricsQueryHelper.contextToTags(context));
          scope.available.contexts = [];
          dSrc.request(
            {
              method: 'POST',
              _cdapPath: '/metrics/search?target=tag&' + tagQueryParams
            },
            function (res) {
              res = res.map(function(v) {
                return context + '.' +  MyMetricsQueryHelper.tagToContext(v);
              });
              scope.available.contexts = res.map(function(d){
                return {
                  value: d.substring(bLen),
                  display: d.substring(bLen+scope.metric.context.length)
                };
              }).filter(function(d) {
                return d.display;
              });
            }
          );

          scope.available.names = [];
          dSrc.request(
            {
              method: 'POST',
              _cdapPath: '/metrics/search?target=metric&' + tagQueryParams
            },
            function (res) {
              var metricsArray = [];
              metricsArray.push({
                id: addAllOptionId,
                label: addAllOptionLabel
              });
              // 'Add All' option to add all metrics in current context.
              res.forEach(function(metric) {
                metricsArray.push({
                  id: metric,
                  label: metric
                });
              });
              scope.available.names = metricsArray;
            }
          );

        }

        var onBlurHandler = ngModel.$setTouched.bind(ngModel);
        elem.find('button').on('blur', onBlurHandler);
        elem.find('input').on('blur', onBlurHandler);

        var metricChanged = function (newVal, oldVal) {
          ngModel.$validate();

          if(newVal.type !== oldVal.type) {
            scope.metric.context = '';
            scope.metric.resetNames();
            fetchAhead();
            return;
          }

          if(newVal.context !== oldVal.context) {
            scope.metric.resetNames();
            fetchAhead();
            return;
          }

          if(newVal.names) {
            var isAddAll = false;
            for (var i = 0; i < newVal.names.length; i++) {
              if (newVal.names[i].name === addAllOptionId) {
                isAddAll = true;
              }
            }
            var context = getBaseContext();
            if (newVal.context) {
              context += '.' + newVal.context;
            }
            var allMetrics = scope.available.names.slice(1).map(function(e) {return e.id;}); // Remove 'Add All' option
            if (isAddAll) {
              ngModel.$setViewValue({
                addAll: true,
                allMetrics: allMetrics,
                context: context,
                names: newVal.getNames(),
                name: newVal.getName()
              });
              return;
            } else {
              ngModel.$setViewValue({
                context: context,
                names: newVal.getNames(),
                name: newVal.getName()
              });
            }
          } else {
            if(ngModel.$dirty) {
              ngModel.$setViewValue(null);
            }

          }

        };
        scope.$watch('metric', metricChanged, true);

        fetchAhead();
      }
    };
  });
