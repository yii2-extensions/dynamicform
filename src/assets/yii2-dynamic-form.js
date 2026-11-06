/**
 * Yii2 Dynamic form
 *
 * A jQuery plugin to clone form elements in a nested manner, maintaining accessibility.
 *
 * @author Wanderson Bragança <wanderson.wbc@gmail.com>
 * @author Stefano Mtangoo <mwinjilisti@gmail.com>
 */
(function ($) {

    var regexID = /^(.+?)(-\d+(?:-\d+)*-)(.+)$/i;
    var regexName = /(^.+?)((?:\[\d+\])+)(\[.+\]$)/i;

    $.fn.yiiDynamicForm = function (method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.yiiDynamicForm');
            return false;
        }
    };

    var events = {
        beforeInsert: 'beforeInsert',
        afterInsert: 'afterInsert',
        beforeDelete: 'beforeDelete',
        afterDelete: 'afterDelete',
        limitReached: 'limitReached'
    };

    var methods = {
        init: function (widgetOptions) {
            return this.each(function () {
                widgetOptions.template = _parseTemplate(widgetOptions);
                _containersOf($(this), widgetOptions).each(function () {
                    _attachValidation(_rootOf($(this)));
                });
            });
        },

        addItem: function (widgetOptions, e, $elem) {
            _addItem(widgetOptions, e, $elem);
        },

        deleteItem: function (widgetOptions, e, $elem) {
            _deleteItem(widgetOptions, e, $elem);
        },

        updateContainer: function () {
            return this.each(function () {
                var $root = _rootOf($(this));
                _prepare($root, _optionsOf($(this)));
                _updateAttributes($root);
                _restoreSpecialJs($root);
                _fixFormValidaton($root);
            });
        }
    };

    var _parseTemplate = function (widgetOptions) {

        var $template = $(widgetOptions.template);
        // A nested widget in the template keeps only its first row.
        $template.find('div[data-dynamicform]').each(function () {
            var nestedOptions = _optionsOf($(this));
            var $items = $(this).find(nestedOptions.widgetItem);
            if ($items.length > 1) {
                $(this).find(nestedOptions.widgetBody).html($items.first()[0].outerHTML);
            }
        });

        $template.find('input, textarea, select').each(function () {
            if ($(this).is(':checkbox, :radio')) {
                $(this).prop('checked', false).removeAttr('checked');
            } else if ($(this).is('select')) {
                $(this).find('option').prop('selected', false).removeAttr('selected');
                $(this).val($(this).prop('multiple') ? [] : '');
            } else {
                // Yii's hidden checkbox/radio inputs carry the configured unchecked value.
                var name = $(this).attr('name');
                var isUncheck = $(this).is(':hidden') && $template.find(':checkbox, :radio').filter(function () {
                    return $(this).attr('name') === name;
                }).length > 0;
                if (!isUncheck) {
                    // A form reset restores `defaultValue` (the `value` attribute of an input, the text of a
                    // textarea), which clearing the current value leaves as the template row rendered it.
                    $(this).prop('defaultValue', '').val('');
                }
            }
        });
        $template.find('.select2-container').remove();
        // Krajee renders a loading indicator, named after the id of the rendered control, that its own initialization
        // removes; a clone is initialized under another id, so the indicator would stay.
        $template.find('.kv-plugin-loading').remove();
        $template.find('[data-select2-id]').removeAttr('data-select2-id');
        $template.find('.select2-hidden-accessible').removeClass('select2-hidden-accessible').removeAttr('aria-hidden tabindex');

        return $template;
    };

    // The outermost dynamic-form container an element belongs to; it owns the rows, the validators and the form, so
    // another container with the same class elsewhere on the page is never touched.
    var _rootOf = function ($element) {
        return $element.parents('div[data-dynamicform]').addBack().filter('div[data-dynamicform]').first();
    };

    var _optionsOf = function ($container) {
        return window[$container.attr('data-dynamicform')];
    };

    var _containersOf = function ($element, widgetOptions) {
        return $element.find('.' + widgetOptions.widgetContainer).addBack('.' + widgetOptions.widgetContainer);
    };

    // The ActiveForm of a root: the enclosing form, or the element with the configured id when the container is
    // rendered outside it. The id is looked up as is, so it needs no CSS escaping.
    var _formOf = function ($root) {
        var $form = $root.closest('form');
        return $form.length > 0 ? $form : $(window.document.getElementById(_optionsOf($root).formId));
    };

    // Validator templates and the ids registered through this root, kept on the root element.
    var _validationState = function ($root) {
        var state = $root.data('dynamicformValidation');
        if (!state) {
            state = { templates: {}, ids: [] };
            $root.data('dynamicformValidation', state);
        }
        return state;
    };

    // The rows of a container: the elements matching `widgetItem` that no other match encloses below the container.
    // Rows may sit in wrappers or in the `tbody` of a table; the rows of a nested widget sit inside a row of the outer
    // one, and so do the elements a control renders with the same class, such as the `.item` of each value TomSelect
    // shows.
    var _rowsOf = function ($container, widgetOptions) {
        return $container.find(widgetOptions.widgetItem).filter(function () {
            return $(this).parentsUntil($container, widgetOptions.widgetItem).length === 0;
        });
    };

    var _count = function ($elem, widgetOptions) {
        return _rowsOf($elem.closest('.' + widgetOptions.widgetContainer), widgetOptions).length;
    };

    var _addItem = function (widgetOptions, e, $elem) {
        var $container = $elem.closest('.' + widgetOptions.widgetContainer);
        var $root = _rootOf($container);
        var count = _count($elem, widgetOptions);

        if (count < widgetOptions.limit) {
            _prepare($root, widgetOptions);
            var $toclone = $(widgetOptions.template);
            var $newclone = $toclone.clone(false, false);

            if (widgetOptions.insertPosition === 'top') {
                $container.find(widgetOptions.widgetBody).prepend($newclone);
            } else {
                $container.find(widgetOptions.widgetBody).append($newclone);
            }

            _updateAttributes($root);
            _restoreSpecialJs($root);
            _fixFormValidaton($root);
            $container.triggerHandler(events.afterInsert, $newclone);
        } else {
            // trigger a custom event for hooking
            $container.triggerHandler(events.limitReached, widgetOptions.limit);
        }
    };

    // Replaces the row indexes of an id that no declared field describes with `{}`: one per widget the input is nested
    // in, counted from the left. Later numeric segments, such as the `1` of `model-0-rates-1-amount`, are literal keys
    // and stay.
    var _validationKey = function (id, level) {
        var remaining = level === undefined ? Infinity : level;
        return id.replace(/-\d+(?=-)/g, function (segment) {
            if (remaining <= 0) {
                return segment;
            }
            remaining--;
            return '-{}';
        });
    };

    var _inputLevel = function ($input) {
        return $input.parents('div[data-dynamicform]').length;
    };

    var _escapeRegExp = function (text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Locates the row indexes of an id or name (`attribute` is 'id' or 'name') through the `fields` of the widget the
    // element belongs to. Each field is `<prefix>{}<rest>`; the prefix is the form name of the row model, with any
    // literal keys it holds, so it is shared by every input of that model. The indexes follow the prefix, one per
    // widget the element is nested in; what follows them is literal. Returns the text before and after the indexes and
    // the indexes, or `null` when no declared prefix followed by that many indexes starts the value.
    var _declaredPath = function ($elem, value, attribute) {
        var options = _optionsOf($elem.closest('div[data-dynamicform]'));
        var level = _inputLevel($elem);
        var separator = attribute === 'id' ? '-' : '][';
        var indexes = '\\d+' + new Array(level).join(_escapeRegExp(separator) + '\\d+');
        var found = null;

        $.each((options && options.fields) || [], function () {
            var pattern = this[attribute] || '';
            var position = pattern.indexOf('{}');
            if (position <= 0) {
                return true;
            }
            var before = pattern.substring(0, position);
            var match = value.match(new RegExp('^' + _escapeRegExp(before) + '(' + indexes + ')' + (attribute === 'id' ? '(?=-|$)' : '(?=\\])')));
            if (match) {
                found = { before: before, indexes: match[1].split(separator), after: value.substring(before.length + match[1].length) };
                return false;
            }
        });

        return found;
    };

    // Template key of the validator of a rendered element: its id with the row indexes replaced by `{}`.
    var _validationKeyOf = function ($elem, id) {
        var path = _declaredPath($elem, id, 'id');
        if (path === null) {
            return _validationKey(id, _inputLevel($elem));
        }
        return path.before + $.map(path.indexes, function () {
            return '{}';
        }).join('-') + path.after;
    };

    // Calls back for every element of the widget rows that has a validator: its own registration when it was rendered
    // with one, otherwise the template of its field. Inputs and the wrappers ActiveForm registers for radio and
    // checkbox lists count; the wrapper name comes from the inputs inside it.
    var _eachValidated = function ($root, callback) {
        var state = _validationState($root);
        $root.find('[id]').each(function () {
            var id = $(this).attr('id');
            var attribute = $(this).data('dynamicformAttribute') || state.templates[_validationKeyOf($(this), id)];
            var name = $(this).attr('name') || $(this).find('[name]').first().attr('name');
            if (attribute && name !== undefined) {
                callback(id, name, attribute, $(this));
            }
        });
    };

    // Key of a registered attribute whose input is not rendered (rows removed by the server for `min` 0), matched
    // against the configured field templates.
    var _templateKeyFor = function (keys, id) {
        for (var key in keys) {
            var pattern = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\\{\\\}|\{\}/g, '\\d+');
            if (new RegExp('^' + pattern + '$').test(id)) {
                return key;
            }
        }
        return _validationKey(id);
    };

    // Ids of the validated fields of the root widget and of the widgets nested in it, as `{}` templates.
    var _templateKeys = function ($root) {
        var keys = {};
        var collect = function (options) {
            $.each((options && options.fields) || [], function () {
                keys[this.id] = true;
            });
        };

        collect(_optionsOf($root));
        $root.find('div[data-dynamicform]').each(function () {
            collect(_optionsOf($(this)));
        });

        return keys;
    };

    // Copies the validators ActiveForm registered for the widget rows: those declared in `fields`, including rows the
    // server removed for `min` 0, and those bound to an input inside the container. The copy is also kept on the
    // element itself, so a renumbered row keeps its own rule while new rows take the field template.
    var _rememberValidation = function ($root) {
        var data = _formOf($root).data('yiiActiveForm');
        var state = _validationState($root);
        if (!data) {
            return;
        }
        var keys = _templateKeys($root);
        $.each(data.attributes, function () {
            var $input = $root.find('[id="' + this.id + '"]');
            var key = $input.length > 0 ? _validationKeyOf($input, this.id) : _templateKeyFor(keys, this.id);
            if (key !== this.id && (keys[key] || $input.length > 0)) {
                var copy = $.extend(true, {}, this);
                state.templates[key] = copy;
                $input.data('dynamicformAttribute', copy);
                if (state.ids.indexOf(this.id) === -1) {
                    state.ids.push(this.id);
                }
            }
        });
    };

    // Rows can be inserted before the window load initialization (jQuery 3 may run it before ActiveForm's DOM ready
    // handler), so the template is parsed and the validators are discovered again before every change.
    var _prepare = function ($root, widgetOptions) {
        if (typeof widgetOptions.template === 'string') {
            widgetOptions.template = _parseTemplate(widgetOptions);
        }
        _rememberValidation($root);
    };

    // Gives a validator to every row that lacks one, such as rows inserted before the window load initialization.
    // ActiveForm initializes on DOM ready, which jQuery 3 may run after that handler, so the step waits for it.
    var _attachValidation = function ($root) {
        var $form = _formOf($root);
        if (!$form.data('yiiActiveForm')) {
            $form.one('afterInit', function () {
                _attachValidation($root);
            });
            return;
        }
        var state = _validationState($root);
        _rememberValidation($root);
        _eachValidated($root, function (id, name, attribute, $input) {
            if ($form.yiiActiveForm('find', id) === undefined) {
                _fixFormValidatonInput($form, attribute, id, name, $input);
                state.ids.push(id);
            }
        });
    };

    var _removeValidations = function ($root) {
        var $form = _formOf($root);
        var state = _validationState($root);
        state.ids.forEach(function (id) {
            $form.yiiActiveForm('remove', id);
        });
        state.ids = [];
    };

    var _deleteItem = function (widgetOptions, e, $elem) {
        var count = _count($elem, widgetOptions);

        if (count > widgetOptions.min) {
            var $todelete = $elem.closest(widgetOptions.widgetItem);
            var $container = $elem.closest('.' + widgetOptions.widgetContainer);
            var $root = _rootOf($container);

            // trigger a custom event for hooking
            var eventResult = $container.triggerHandler(events.beforeDelete, $todelete);
            if (eventResult !== false) {
                _prepare($root, widgetOptions);
                _removeValidations($root);
                // TomSelect listens on the document and the window for each instance until it is destroyed, which
                // removing its row does not do.
                $todelete.find('select.tomselected').each(function () {
                    this.tomselect.destroy();
                });
                $todelete.remove();
                _updateAttributes($root);
                _restoreSpecialJs($root);
                _fixFormValidaton($root);
                $container.triggerHandler(events.afterDelete);
            }
        }
    };

    // Returns the row identifiers of an id or name: the first becomes the root row index, each following one the
    // position of the row of the widget nested at that level.
    var _rowIdentifiers = function ($elem, identifiers, index) {
        identifiers[0] = index;

        if (identifiers.length > 1) {
            var widgetsOptions = [];
            $elem.parents('div[data-dynamicform]').each(function (i) {
                widgetsOptions[i] = _optionsOf($(this));
            });

            widgetsOptions = widgetsOptions.reverse();
            for (var i = identifiers.length - 1; i >= 1; i--) {
                if (widgetsOptions[i]) {
                    identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                }
            }
        }

        return identifiers;
    };

    var _updateAttrID = function ($elem, index) {
        var widgetOptions = _optionsOf($elem.closest('div[data-dynamicform]'));
        var id = $elem.attr('id');
        var newID = id;

        if (id !== undefined) {
            var path = _declaredPath($elem, id, 'id');
            var matches = id.match(regexID);
            if (path !== null) {
                newID = path.before + _rowIdentifiers($elem, path.indexes, index).join('-') + path.after;
                $elem.attr('id', newID);
            } else if (matches && matches.length === 4) {
                matches[2] = matches[2].substring(1, matches[2].length - 1);
                var identifiers = _rowIdentifiers($elem, matches[2].split('-'), index);

                newID = matches[1] + '-' + identifiers.join('-') + '-' + matches[3];
                $elem.attr('id', newID);
            } else {
                // Non-tabular ids get the row index; the original id is kept so repeated updates stay stable.
                var baseID = $elem.attr('data-dynamicform-id') || id;
                $elem.attr('data-dynamicform-id', baseID);
                newID = baseID + '-' + index;
                $elem.attr('id', newID);
            }
        }

        if (id !== newID) {
            $elem.closest(widgetOptions.widgetItem).find('.field-' + id).each(function () {
                $(this).removeClass('field-' + id).addClass('field-' + newID);
            });
            // update "for" attribute
            $elem.closest(widgetOptions.widgetItem).find("label[for='" + id + "']").attr('for', newID);
        }

        return newID;
    };

    var _updateAttrName = function ($elem, index) {
        var name = $elem.attr('name');

        if (name !== undefined) {
            var path = _declaredPath($elem, name, 'name');
            var matches = name.match(regexName);

            if (path !== null) {
                name = path.before + _rowIdentifiers($elem, path.indexes, index).join('][') + path.after;
                $elem.attr('name', name);
            } else if (matches && matches.length === 4) {
                matches[2] = matches[2].replace(/\]\[/g, "-").replace(/\]|\[/g, '');
                var identifiers = _rowIdentifiers($elem, matches[2].split('-'), index);

                name = matches[1] + '[' + identifiers.join('][') + ']' + matches[3];
                $elem.attr('name', name);
            }
        }

        return name;
    };

    var _updateAttributes = function ($root) {
        _rowsOf($root, _optionsOf($root)).each(function (index) {
            $(this).find('*').each(function () {
                // update "id" attribute
                _updateAttrID($(this), index);

                // update "name" attribute
                _updateAttrName($(this), index);
            });
        });
    };

    // Registers the validator of one row element; its initial value comes from that element, not from a page-wide id
    // lookup, because another form may render the same ids.
    var _fixFormValidatonInput = function ($form, attribute, id, name, $input) {
        if (attribute !== undefined) {
            attribute = $.extend(true, {}, attribute);
            attribute.id = id;
            attribute.container = ".field-" + id;
            attribute.input = "#" + id;
            attribute.name = name;
            attribute.value = $input.val();
            attribute.status = 0;

            if ($form.yiiActiveForm("find", id) !== undefined) {
                $form.yiiActiveForm("remove", id);
            }

            $form.yiiActiveForm("add", attribute);
        }
    };

    var _fixFormValidaton = function ($root) {
        var $form = _formOf($root);
        if (!$form.data('yiiActiveForm')) {
            return;
        }
        var state = _validationState($root);
        _removeValidations($root);
        _eachValidated($root, function (id, name, attribute, $input) {
            _fixFormValidatonInput($form, attribute, id, name, $input);
            state.ids.push(id);
        });
    };

    // Points ids of a DepDrop configuration at the row of the element. An id the declared fields describe takes only the
    // row indexes of the element and keeps its own literal keys; any other one takes the numeric segments of the
    // element id, as before. An id moves only when the row holds an element with the moved id, so an input outside
    // the rows, such as a shared filter whose id holds a number, keeps its id.
    var _depdropRowIDs = function ($elem, ids) {
        var inputID = $elem.attr('id');
        var inputPath = _declaredPath($elem, inputID, 'id');
        var matchID = inputID.match(regexID);
        var $row = $elem.parents(_optionsOf(_rootOf($elem)).widgetItem).last();

        if (inputPath === null && !(matchID && matchID.length === 4)) {
            return ids;
        }

        return $.map(ids, function (id) {
            var dependPath = inputPath === null ? null : _declaredPath($elem, id, 'id');
            var match = id.match(regexID);
            var rowID = id;
            if (dependPath !== null) {
                rowID = dependPath.before + inputPath.indexes.join('-') + dependPath.after;
            } else if (matchID && matchID.length === 4 && match && match.length === 4) {
                rowID = match[1] + matchID[2] + match[3];
            }
            var inRow = $row.find('[id]').filter(function () {
                return this.id === rowID;
            }).length > 0;
            return inRow ? rowID : id;
        });
    };

    // Points a DepDrop at the row of the element: `depends` (the selects it listens to) and `params` (the inputs whose
    // values its requests carry). A row without a DepDrop gets a new one. An initialized DepDrop keeps its instance:
    // its listeners are bound to the dependency elements of its own row, which move with the row, and only the ids
    // through which it reads their values change, so renumbering adds no listener and no duplicated request. Returns
    // whether a DepDrop was created.
    var _restoreKrajeeDepdrop = function ($elem) {
        var configDepdrop = $.extend(true, {}, eval($elem.attr('data-krajee-depdrop')));
        var depdrop = $elem.data('depdrop');

        configDepdrop.depends = _depdropRowIDs($elem, configDepdrop.depends);
        if (Array.isArray(configDepdrop.params)) {
            configDepdrop.params = _depdropRowIDs($elem, configDepdrop.params);
        }

        if (depdrop === undefined) {
            $elem.depdrop(configDepdrop);
            return true;
        }

        // dependent-dropdown reads the dependency ids through the array its listeners were given and the parameter ids
        // through the element data, so both are updated in place.
        for (var index = 0; index < depdrop.depends.length; ++index) {
            depdrop.depends[index] = configDepdrop.depends[index];
        }
        if (Array.isArray(configDepdrop.params)) {
            depdrop.params = configDepdrop.params;
            $elem.data('params', configDepdrop.params);
        }
        return false;
    };

    // Points the TomSelect instance of a renumbered select at its own row. _updateAttributes() renamed the elements
    // TomSelect generated in the row (control, listbox, label and rendered options), while the instance keeps the id
    // the select had at initialization (`inputId` in TomSelect 2) in its ARIA references and in the ids of the options
    // it renders later, which would then name the elements of the row inserted with that index.
    var _renumberTomSelect = function (select) {
        var tomselect = select.tomselect;
        // An instance without the TomSelect 2 internals is left as it is.
        if (tomselect.inputId === undefined || tomselect.inputId === select.id) {
            return;
        }

        tomselect.inputId = select.id;
        tomselect.focus_node.setAttribute('aria-controls', tomselect.dropdown_content.id);
        $(select).parents(_optionsOf(_rootOf($(select))).widgetItem).last().find('label').filter(function () {
            return $(this).attr('for') === tomselect.focus_node.id;
        }).each(function () {
            tomselect.focus_node.setAttribute('aria-labelledby', this.id);
            tomselect.dropdown_content.setAttribute('aria-labelledby', this.id);
        });
        // Rendered options are cached; those a search left out of the listbox were not renamed with the row.
        $.each(tomselect.options, function (key, option) {
            option.$id = select.id + '-opt-' + option.$order;
            if (option.$div) {
                option.$div.id = option.$id;
            }
        });
    };

    var _restoreSpecialJs = function ($root) {
        var $items = $root.find(_optionsOf($root).widgetItem);

        // "jquery.inputmask"
        var $hasInputmask = $items.find('[data-plugin-inputmask]');
        if ($hasInputmask.length > 0) {
            $hasInputmask.each(function () {
                $(this).inputmask('remove');
                $(this).inputmask(eval($(this).attr('data-plugin-inputmask')));
            });
        }

        // JUI Datepicker
        /*$( ".picker" ).each(function() {
            $( this ).datepicker({
                dateFormat : 'dd-mm-yy',
                language : 'en',
            });
        });*/

        // "kartik-v/yii2-widget-datepicker"
        var datePickers = $items.find('[data-krajee-kvdatepicker]');
        datePickers.each(function (index, el) {
            //$(this).parent().removeData().kvDatepicker('remove');
            $(this).parent().kvDatepicker(eval($(this).attr('data-krajee-kvdatepicker')));
        });

        // "kartik-v/yii2-widget-timepicker"
        var $hasTimepicker = $items.find('[data-krajee-timepicker]');
        if ($hasTimepicker.length > 0) {
            $hasTimepicker.each(function () {
                $(this).removeData().off();
                $(this).parent().find('.bootstrap-timepicker-widget').remove();
                $(this).unbind();
                $(this).timepicker(eval($(this).attr('data-krajee-timepicker')));
            });
        }

        // "kartik-v/yii2-money"
        var $hasMaskmoney = $items.find('[data-krajee-maskMoney]');
        if ($hasMaskmoney.length > 0) {
            $hasMaskmoney.each(function () {
                $(this).parent().find('input').removeData().off();
                var id = '#' + $(this).attr('id');
                var displayID = id + '-disp';
                $(displayID).maskMoney('destroy');
                $(displayID).maskMoney(eval($(this).attr('data-krajee-maskMoney')));
                $(displayID).maskMoney('mask', parseFloat($(id).val()));
                $(displayID).on('change', function () {
                    var numDecimal = $(displayID).maskMoney('unmasked')[0];
                    $(id).val(numDecimal);
                    $(id).trigger('change');
                });
            });
        }

        // "kartik-v/yii2-widget-fileinput"
        var $hasFileinput = $items.find('[data-krajee-fileinput]');
        if ($hasFileinput.length > 0) {
            $hasFileinput.each(function () {
                $(this).fileinput(eval($(this).attr('data-krajee-fileinput')));
            });
        }

        // "kartik-v/yii2-widget-touchspin"
        var $hasTouchSpin = $items.find('[data-krajee-TouchSpin]');
        if ($hasTouchSpin.length > 0) {
            $hasTouchSpin.each(function () {
                $(this).TouchSpin('destroy');
                $(this).TouchSpin(eval($(this).attr('data-krajee-TouchSpin')));
            });
        }

        // "kartik-v/yii2-widget-colorinput"
        var $hasSpectrum = $items.find('[data-krajee-spectrum]');
        if ($hasSpectrum.length > 0) {
            $hasSpectrum.each(function () {
                var id = '#' + $(this).attr('id');
                var sourceID = id + '-source';
                $(sourceID).spectrum('destroy');
                $(sourceID).unbind();
                $(id).unbind();
                var configSpectrum = eval($(this).attr('data-krajee-spectrum'));
                configSpectrum.change = function (color) {
                    jQuery(id).val(color.toString());
                };
                $(sourceID).attr('name', $(sourceID).attr('id'));
                $(sourceID).spectrum(configSpectrum);
                $(sourceID).spectrum('set', jQuery(id).val());
                $(id).on('change', function () {
                    $(sourceID).spectrum('set', jQuery(id).val());
                });
            });
        }

        // "kartik-v/yii2-widget-depdrop"
        var $newDepdrops = $();
        $items.find('[data-krajee-depdrop]').each(function () {
            if (_restoreKrajeeDepdrop($(this))) {
                $newDepdrops = $newDepdrops.add(this);
            }
        });

        // "TomSelect": `data-tomselect` marks the selects in the server markup, so clones carry it; `tomselected` is
        // the class TomSelect itself adds to an initialized select. Initialized selects keep their instance.
        var $hasTomSelect = $items.find('select[data-tomselect], select.tomselected');
        if ($hasTomSelect.length > 0 && typeof TomSelect !== 'undefined') {
            $hasTomSelect.each(function () {
                if (!this.tomselect) {
                    new TomSelect(this, {
                        plugins: ['remove_button', 'dropdown_input'],
                        width: '100%',
                        allowEmptyOption: true
                    });
                } else {
                    _renumberTomSelect(this);
                }
            });
        }

        // "kartik-v/yii2-widget-select2": `data-s2-options` names the global variable holding the Kartik options (theme,
        // reset, toggle all, order) that initS2Loading() applies once Select2 is initialized.
        var $hasSelect2 = $items.find('[data-krajee-select2]');
        if ($hasSelect2.length > 0) {
            $hasSelect2.each(function () {
                var id = $(this).attr('id');
                var select2 = $(this).data('select2');
                // A Select2 created for the current id (Select2 4 names its instance `select2-<id>`) stays as it is:
                // initializing it again would destroy its dropdown together with the controls Kartik moved into it, such
                // as the toggle all button. New and renumbered controls are initialized.
                if (select2 !== undefined && select2.id === 'select2-' + id.replace(/(:|\.|\[|\]|,)/g, '')) {
                    return;
                }
                var configSelect2 = eval($(this).attr('data-krajee-select2'));
                $.when($('#' + id).select2(configSelect2)).done(initS2Loading(id, $(this).attr('data-s2-options')));
                // Select2 3.x announced its dropdown with `select2-open`, styled by Kartik's initSelect2DropStyle() of
                // that time; Select2 4 emits `select2:open` and current Kartik releases define no such function.
                if (typeof initSelect2DropStyle === 'function') {
                    $('#' + id).off('select2-open.dynamicform').on('select2-open.dynamicform', function () {
                        initSelect2DropStyle(id);
                    });
                }
                // The server registered Kartik's Select2 handling of DepDrop requests (loading text, `change` after
                // each load) for the rendered rows only; a DepDrop created for a new row gets it here.
                if ($newDepdrops.is(this) && typeof initDepdropS2 === 'function') {
                    var configDepdrop = eval($(this).attr('data-krajee-depdrop'));
                    initDepdropS2(id, configDepdrop.loadingText ? configDepdrop.loadingText : 'Loading ...');
                }
            });
        }

        // "kartik-v/yii2-numbercontrol"
        var $hasNumberControl = $items.find('[data-krajee-numbercontrol]');
        if ($hasNumberControl.length > 0) {
            $hasNumberControl.each(function () {
                var configNumberControl = eval($(this).attr('data-krajee-numbercontrol'));
                configNumberControl.displayId = $(this).parent().prev().attr('id');
                if ($(this).data('numberControl')) { $(this).numberControl('destroy'); }
                $(this).numberControl(configNumberControl);
            });
        }
    };

})(window.jQuery);
