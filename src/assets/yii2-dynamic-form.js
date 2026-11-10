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
                    var $root = _rootOf($(this));
                    if ($root.length > 0) {
                        _attachValidation($root);
                    }
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
            // Clones take the default state of checkboxes, radios and options, the `checked` and `selected` attributes,
            // and not their current state; a single select without a selected option shows its first one.
            if ($(this).is(':checkbox, :radio')) {
                $(this).removeAttr('checked');
            } else if ($(this).is('select')) {
                $(this).find('option').removeAttr('selected');
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
        // Krajee renders a loading indicator, named after the id of the rendered control, that its own initialization
        // removes; a clone is initialized under another id, so the indicator would stay.
        $template.find('.kv-plugin-loading').remove();
        // Kartik renders the date of an inline DatePicker in `data-date` of its container, which bootstrap-datepicker
        // reads before the input value.
        $template.find('[data-krajee-kvdatepicker]').parent().removeAttr('data-date');

        return $template;
    };

    // The outermost dynamic-form container an element belongs to; it owns the rows, the validators and the form, so
    // another container with the same class elsewhere on the page is never touched.
    var _rootOf = function ($element) {
        return $element.parents().addBack().filter('div[data-dynamicform]').first();
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

    // Validator templates and the ids registered through this root (each id keyed by itself), kept on the root element.
    var _validationState = function ($root) {
        var state = $root.data('dynamicformValidation');
        if (!state) {
            state = { templates: {}, ids: {} };
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
            var $newclone = widgetOptions.template.clone();

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
        var remaining = level;
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

    // Escape a CSS identifier without requiring $.escapeSelector(), which is absent in Yii-supported jQuery 1/2.
    var _escapeSelector = function (id) {
        return String(id).replace(/(^-?\d)|^-$|[^\x80-\uFFFF\w-]/g, function (character, codePoint) {
            if (codePoint || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) {
                return character === '\0' ? '\uFFFD' :
                    character.slice(0, -1) + '\\' + character.charCodeAt(character.length - 1).toString(16) + ' ';
            }
            return '\\' + character;
        });
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
        var fields = (options && options.fields) || [];

        for (var i = 0; i < fields.length; i++) {
            var before = fields[i][attribute].substring(0, fields[i][attribute].indexOf('{}'));
            var match = value.match(new RegExp('^' + _escapeRegExp(before) + '(' + indexes + ')' + (attribute === 'id' ? '(?=-|$)' : '(?=\\])')));
            if (match) {
                return { before: before, indexes: match[1].split(separator), after: value.substring(before.length + match[1].length) };
            }
        }

        return null;
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

    // Whether an element sits in a row of a widget it is nested in: below a `widgetItem` match inside that widget's
    // container, the outermost of which is a row for _rowsOf(). A field of an outer row may sit in an inner widget next
    // to its rows. An element outside every row is not a row field, even when its id has the shape of one.
    var _inRow = function ($elem) {
        return $elem.parents('div[data-dynamicform]').filter(function () {
            return $elem.parentsUntil(this, _optionsOf($(this)).widgetItem).length > 0;
        }).length > 0;
    };

    // Calls back for every element of the widget that has a validator: its own registration when it was rendered with
    // one, which follows it also out of its row, otherwise, inside a row, the template of its field. Inputs and the
    // wrappers ActiveForm registers for radio and checkbox lists count; the wrapper name comes from the inputs inside it.
    var _eachValidated = function ($root, callback) {
        var state = _validationState($root);
        $root.find('[id]').each(function () {
            var id = $(this).attr('id');
            var attribute = $(this).data('dynamicformAttribute') ||
                (_inRow($(this)) && state.templates[_validationKeyOf($(this), id)]);
            var name = $(this).attr('name') || $(this).find('[name]').first().attr('name');
            if (attribute && name !== undefined) {
                callback(id, name, attribute, $(this));
            }
        });
    };

    // Key of a registered attribute whose input is not rendered (rows removed by the server for `min` 0), matched
    // against the configured field templates; the id itself when none describes it, so it is not taken as a template.
    var _templateKeyFor = function (keys, id) {
        var matching = $.grep(keys, function (key) {
            return new RegExp('^' + _escapeRegExp(key).replace(/\\\{\\\}/g, '\\d+') + '$').test(id);
        });
        return matching.length > 0 ? matching[0] : id;
    };

    // Ids of the validated fields of the root widget and of the widgets nested in it, as `{}` templates.
    var _templateKeys = function ($root) {
        return $.map($root.find('div[data-dynamicform]').addBack(), function (container) {
            return $.map(_optionsOf($(container)).fields, function (field) {
                return field.id;
            });
        });
    };

    // Copies the validators ActiveForm registered for the widget rows: those declared in `fields`, including rows the
    // server removed for `min` 0, and those bound to an input inside a row. The copy is also kept on the element itself,
    // so a renumbered row keeps its own rule while new rows take the field template. An input of the container outside
    // the rows keeps its registration as ActiveForm made it.
    var _rememberValidation = function ($root) {
        var data = _formOf($root).data('yiiActiveForm');
        var state = _validationState($root);
        if (!data) {
            return;
        }
        var keys = _templateKeys($root);
        $.each(data.attributes, function () {
            var id = this.id;
            // The id is compared as literal text, as a selector built from it would read quotes as selector syntax.
            var $input = $root.find('[id]').filter(function () {
                return this.id === id;
            });
            if ($input.length > 0 && !_inRow($input)) {
                return true;
            }
            var key = $input.length > 0 ? _validationKeyOf($input, id) : _templateKeyFor(keys, id);
            if (key !== id) {
                // A copy, so the rule a row keeps does not change with the registration ActiveForm updates.
                var copy = $.extend({}, this);
                state.templates[key] = copy;
                $input.data('dynamicformAttribute', copy);
                state.ids[id] = id;
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
                state.ids[id] = id;
            }
        });
    };

    var _removeValidations = function ($root) {
        var $form = _formOf($root);
        var state = _validationState($root);
        $.each(state.ids, function (id) {
            $form.yiiActiveForm('remove', id);
        });
        state.ids = {};
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
                // TomSelect listens on the document and the window for each instance until it is destroyed, which
                // removing its row does not do.
                $todelete.find('select.tomselected').each(function () {
                    this.tomselect.destroy();
                });
                // bootstrap-datepicker listens on the document while a calendar is shown, which an inline calendar
                // always is, until its instance is destroyed. Every Kartik DatePicker of a row has one: the server
                // initialized the rendered rows and _restoreSpecialJs() the inserted ones.
                $todelete.find('[data-krajee-kvdatepicker]').each(function () {
                    _datePickerOf($(this)).kvDatepicker('destroy');
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
        var containers = $elem.parents('div[data-dynamicform]').get().reverse();

        identifiers[0] = index;
        for (var i = identifiers.length - 1; i >= 1; i--) {
            var options = _optionsOf($(containers[i]));
            if (options) {
                identifiers[i] = $elem.closest(options.widgetItem).index();
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
            } else if (matches) {
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
            // The container class and the label target are compared with the old id as literal text: a selector built
            // from it would read characters such as `.`, `:` or a quote as selector syntax.
            $elem.closest(widgetOptions.widgetItem).find('*').filter(function () {
                return $(this).hasClass('field-' + id);
            }).each(function () {
                $(this).removeClass('field-' + id).addClass('field-' + newID);
            });
            // update "for" attribute
            $elem.closest(widgetOptions.widgetItem).find('label').filter(function () {
                return $(this).attr('for') === id;
            }).attr('for', newID);
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
            } else if (matches) {
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

    // Selector of a registered element for the element `id`: where the selector names the id of the registration it
    // comes from, as is or backslash-escaped as `$.escapeSelector()` writes it, that id is replaced by the new one in the
    // same form, so application `ActiveField::$selectors` survive; otherwise `null`, so the escaped default applies.
    var _rowSelector = function (selector, sourceId, id) {
        var found = false;
        var pattern = new RegExp(String(sourceId).replace(/[^\w-]/g, function (character) {
            return '\\\\?' + _escapeRegExp(character);
        }), 'g');
        var rewritten = String(selector).replace(pattern, function (match) {
            found = true;
            return match.indexOf('\\') === -1 ? id : id.replace(/[^\w-]/g, '\\$&');
        });

        return found ? rewritten : null;
    };

    // Registers the validator of one row element; its initial value comes from that element, not from a page-wide id
    // lookup, because another form may render the same ids. `attribute` is the template _eachValidated() found.
    var _fixFormValidatonInput = function ($form, attribute, id, name, $input) {
        attribute = $.extend(true, {}, attribute);
        var escapedId = _escapeSelector(id);
        var container = _rowSelector(attribute.container, attribute.id, id);
        var input = _rowSelector(attribute.input, attribute.id, id);
        var $container = $form.find(container);
        var $selectedInput = $form.find(input);

        // Replacing the id can leave other constraints, such as a tabular name, pointing at the old row. Keep only
        // selectors that resolve to this field in this form, never a missing, different or additional field.
        attribute.container = $container.length === 1 && $.contains($container[0], $input[0]) ? container : ".field-" + escapedId;
        attribute.input = $selectedInput.length === 1 && $selectedInput[0] === $input[0] ? input : "#" + escapedId;
        attribute.id = id;
        attribute.name = name;
        attribute.value = $input.val();
        attribute.status = 0;

        // A registration the application made for the id is replaced; removing an id without one changes nothing.
        $form.yiiActiveForm("remove", id);
        $form.yiiActiveForm("add", attribute);
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
            state.ids[id] = id;
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

        return $.map(ids, function (id) {
            var dependPath = inputPath === null ? null : _declaredPath($elem, id, 'id');
            var match = id.match(regexID);
            var rowID = id;
            if (dependPath !== null) {
                rowID = dependPath.before + inputPath.indexes.join('-') + dependPath.after;
            } else if (matchID && match) {
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
        // The options variable is shared by every row; dependent-dropdown copies the options it is given, and a
        // missing `params` becomes an empty list, which it treats as its default.
        var configDepdrop = $.extend({}, eval($elem.attr('data-krajee-depdrop')));
        var depdrop = $elem.data('depdrop');

        configDepdrop.depends = _depdropRowIDs($elem, configDepdrop.depends);
        configDepdrop.params = _depdropRowIDs($elem, configDepdrop.params);

        if (depdrop === undefined) {
            $elem.depdrop(configDepdrop);
            return true;
        }

        // dependent-dropdown reads the dependency ids through the array its listeners were given and the parameter ids
        // through the element data, so both are updated in place.
        for (var index = 0; index < depdrop.depends.length; ++index) {
            depdrop.depends[index] = configDepdrop.depends[index];
        }
        depdrop.params = configDepdrop.params;
        $elem.data('params', configDepdrop.params);
        return false;
    };

    // Points the TomSelect instance of a renumbered select at its own row. _updateAttributes() renamed the elements
    // TomSelect generated in the row (control, listbox, label and rendered options), while the instance keeps the id
    // the select had at initialization (`inputId` in TomSelect 2) in its ARIA references and in the ids of the options
    // it renders later, which would then name the elements of the row inserted with that index.
    var _renumberTomSelect = function (select) {
        var tomselect = select.tomselect;
        // An instance without the TomSelect 2 internals is left as it is.
        if (tomselect.inputId === undefined) {
            return;
        }

        tomselect.inputId = select.id;
        // A listbox the page mounted outside the row (`dropdownParent`) was not renamed with it.
        tomselect.dropdown_content.id = select.id + '-ts-dropdown';
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
        // `aria-activedescendant` names the active option by id; a single select keeps it after closing. Activating
        // the same option again refers to its new id; without an active option nothing is set.
        var active = tomselect.activeOption;
        tomselect.clearActiveOption();
        tomselect.setActiveOption(active, false);
    };

    // The element a Kartik DatePicker initializes: the input itself for `TYPE_INPUT` (`data-datepicker-type` 1), the
    // element around it for the components, the inline calendar and the button.
    var _datePickerOf = function ($input) {
        return $input.attr('data-datepicker-type') === '1' ? $input : $input.parent();
    };

    var _restoreSpecialJs = function ($root) {
        var $items = $root.find(_optionsOf($root).widgetItem);

        // "jquery.inputmask": `data-plugin-inputmask` names the global variable holding the options of Yii's
        // MaskedInput. Only inputs without an instance (those of inserted rows) are masked: an instance refers to its
        // element, not to its id, so a renumbered row keeps it with its value and the options the page set on it.
        // Masking an input again binds another `submit`/`reset` handler pair on the form, which Inputmask never unbinds.
        $items.find('[data-plugin-inputmask]').each(function () {
            if (this.inputmask === undefined) {
                $(this).inputmask(eval($(this).attr('data-plugin-inputmask')));
            }
        });

        // "kartik-v/yii2-widget-datepicker": `data-krajee-kvdatepicker` names the global variable holding the options.
        // Only controls without an instance (those of inserted rows) are initialized: an instance refers to its
        // element, not to its id, so a renumbered row keeps it with its date. `data-datepicker-source` names the element
        // the instance belongs to, as DatePicker renders it.
        $items.find('[data-krajee-kvdatepicker]').each(function () {
            var $picker = _datePickerOf($(this));

            $(this).attr('data-datepicker-source', $picker.attr('id'));
            if ($picker.data('datepicker') === undefined) {
                $picker.kvDatepicker(eval($(this).attr('data-krajee-kvdatepicker')));
                // The server bound the remove button of the rendered components through this Kartik function, which
                // binds nothing where the control has no remove button.
                initDPRemove(this.id);
            }
        });

        // "kartik-v/yii2-widget-timepicker", "kartik-v/yii2-widget-fileinput" and "kartik-v/yii2-widget-touchspin":
        // `data-krajee-<plugin>` names the global variable holding the options. Each plugin initializes only an element
        // without an instance (those of inserted rows); an instance refers to its element, and the markup it generates
        // sits in the row, so a renumbered row keeps both.
        $items.find('[data-krajee-timepicker]').each(function () {
            $(this).timepicker(eval($(this).attr('data-krajee-timepicker')));
        });
        $items.find('[data-krajee-fileinput]').each(function () {
            $(this).fileinput(eval($(this).attr('data-krajee-fileinput')));
        });
        $items.find('[data-krajee-TouchSpin]').each(function () {
            $(this).TouchSpin(eval($(this).attr('data-krajee-TouchSpin')));
        });

        // "kartik-v/yii2-money": the hidden input holding the value names the options; its display input, `<id>-disp`,
        // is masked. The server binds the display of each rendered row to the ids of that row, which renumbering
        // changes, so every display gets one handler bound to its own elements in place of the `change`/`keyup` ones.
        $items.find('[data-krajee-maskMoney]').each(function () {
            var $value = $(this);
            var $display = $(window.document.getElementById(this.id + '-disp'));

            $display.maskMoney(eval($value.attr('data-krajee-maskMoney')));
            $display.maskMoney('mask', parseFloat($value.val()));
            $display.off('change keyup').on('change', function () {
                $value.val($display.maskMoney('unmasked')[0]).trigger('change');
            });
        });

        // "kartik-v/yii2-widget-depdrop"
        var $newDepdrops = $();
        $items.find('[data-krajee-depdrop]').each(function () {
            if (_restoreKrajeeDepdrop($(this))) {
                $newDepdrops = $newDepdrops.add(this);
            }
        });

        // "TomSelect": `data-tomselect` marks the selects in the server markup, so clones carry it; `tomselected` is
        // the class TomSelect itself adds to an initialized select. Initialized selects keep their instance.
        if (typeof TomSelect !== 'undefined') {
            $items.find('select[data-tomselect], select.tomselected').each(function () {
                if (!this.tomselect) {
                    new TomSelect(this, {
                        plugins: ['remove_button', 'dropdown_input'],
                        allowEmptyOption: true
                    });
                } else {
                    _renumberTomSelect(this);
                }
            });
        }

        // "kartik-v/yii2-widget-select2": `data-s2-options` names the global variable holding the Kartik options (theme,
        // reset, toggle all, order) that initS2Loading() applies once Select2 is initialized.
        $items.find('[data-krajee-select2]').each(function () {
            var id = $(this).attr('id');
            var select2 = $(this).data('select2');
            // A Select2 created for the current id (Select2 4 names its instance `select2-<id>`) stays as it is:
            // initializing it again would destroy its dropdown together with the controls Kartik moved into it, such
            // as the toggle all button. New and renumbered controls are initialized, through the element itself, as
            // an id may hold selector syntax.
            if (select2 !== undefined && select2.id === 'select2-' + id.replace(/(:|\.|\[|\]|,)/g, '')) {
                return;
            }
            var configSelect2 = eval($(this).attr('data-krajee-select2'));
            $.when($(this).select2(configSelect2)).done(initS2Loading(id, $(this).attr('data-s2-options')));
            // Select2 3.x announced its dropdown with `select2-open`, styled by Kartik's initSelect2DropStyle() of
            // that time; Select2 4 emits `select2:open` and current Kartik releases define no such function.
            if (typeof initSelect2DropStyle === 'function') {
                $(this).off('select2-open.dynamicform').on('select2-open.dynamicform', function () {
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

        // "kartik-v/yii2-number": the hidden input holding the value names the options; the display input before its
        // wrapper is masked. The options name the display of the rendered row, so each row is initialized with its own;
        // an initialized row keeps its instance.
        $items.find('[data-krajee-numbercontrol]').each(function () {
            $(this).numberControl($.extend({}, eval($(this).attr('data-krajee-numbercontrol')), {
                displayId: $(this).parent().prev().attr('id')
            }));
        });
    };

})(window.jQuery);
