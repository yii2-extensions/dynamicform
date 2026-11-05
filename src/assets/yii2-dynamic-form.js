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
                _rememberValidation(widgetOptions);
            });
        },

        addItem: function (widgetOptions, e, $elem) {
            _addItem(widgetOptions, e, $elem);
        },

        deleteItem: function (widgetOptions, e, $elem) {
            _deleteItem(widgetOptions, e, $elem);
        },

        updateContainer: function () {
            var widgetOptions = eval($(this).attr('data-dynamicform'));
            _updateAttributes(widgetOptions);
            _restoreSpecialJs(widgetOptions);
            _fixFormValidaton(widgetOptions);
        }
    };

    var _parseTemplate = function (widgetOptions) {

        var $template = $(widgetOptions.template);
        $template.find('div[data-dynamicform]').each(function () {
            var widgetOptions = eval($(this).attr('data-dynamicform'));
            if ($(widgetOptions.widgetItem).length > 1) {
                var item = $(this).find(widgetOptions.widgetItem).first()[0].outerHTML;
                $(this).find(widgetOptions.widgetBody).html(item);
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
                    $(this).val('');
                }
            }
        });
        $template.find('.select2-container').remove();
        $template.find('[data-select2-id]').removeAttr('data-select2-id');
        $template.find('.select2-hidden-accessible').removeClass('select2-hidden-accessible').removeAttr('aria-hidden tabindex');

        return $template;
    };

    var _getWidgetOptionsRoot = function (widgetOptions) {
        var $root = $('.' + widgetOptions.widgetContainer).first().parents('div[data-dynamicform]').last();
        return $root.length ? window[$root.attr('data-dynamicform')] : widgetOptions;
    };

    var _count = function ($elem, widgetOptions) {
        return $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetItem).length;
    };

    var _addItem = function (widgetOptions, e, $elem) {
        var $container = $elem.closest('.' + widgetOptions.widgetContainer);
        var count = _count($elem, widgetOptions);

        if (count < widgetOptions.limit) {
            var $toclone = $(widgetOptions.template);
            var $newclone = $toclone.clone(false, false);

            if (widgetOptions.insertPosition === 'top') {
                $container.find(widgetOptions.widgetBody).prepend($newclone);
            } else {
                $container.find(widgetOptions.widgetBody).append($newclone);
            }

            _updateAttributes(widgetOptions);
            _restoreSpecialJs(widgetOptions);
            _fixFormValidaton(widgetOptions);
            $container.triggerHandler(events.afterInsert, $newclone);
        } else {
            // trigger a custom event for hooking
            $container.triggerHandler(events.limitReached, widgetOptions.limit);
        }
    };

    var _validationKey = function (id) {
        return id.replace(/-\d+(?=-)/g, '-{}');
    };

    var _rememberValidation = function (widgetOptions) {
        var root = _getWidgetOptionsRoot(widgetOptions);
        var $form = $('#' + root.formId);
        var data = $form.data('yiiActiveForm');
        root.validationTemplates = root.validationTemplates || {};
        root.validationIds = root.validationIds || [];
        if (!data) {
            return;
        }
        $('.' + root.widgetContainer).find('input, textarea, select').each(function () {
            var id = $(this).attr('id');
            var attribute = id && $form.yiiActiveForm('find', id);
            if (attribute) {
                root.validationTemplates[_validationKey(id)] = $.extend(true, {}, attribute);
                if (root.validationIds.indexOf(id) === -1) {
                    root.validationIds.push(id);
                }
            }
        });
    };

    var _removeValidations = function (widgetOptions) {
        var root = _getWidgetOptionsRoot(widgetOptions);
        var $form = $('#' + root.formId);
        (root.validationIds || []).forEach(function (id) {
            $form.yiiActiveForm('remove', id);
        });
        root.validationIds = [];
    };

    var _deleteItem = function (widgetOptions, e, $elem) {
        var count = _count($elem, widgetOptions);

        if (count > widgetOptions.min) {
            var $todelete = $elem.closest(widgetOptions.widgetItem);
            var $container = $elem.closest('.' + widgetOptions.widgetContainer);

            // trigger a custom event for hooking
            var eventResult = $container.triggerHandler(events.beforeDelete, $todelete);
            if (eventResult !== false) {
                _removeValidations(widgetOptions);
                $todelete.remove();
                _updateAttributes(widgetOptions);
                _restoreSpecialJs(widgetOptions);
                _fixFormValidaton(widgetOptions);
                $container.triggerHandler(events.afterDelete);
            }
        }
    };

    var _updateAttrID = function ($elem, index) {
        var widgetOptions = eval($elem.closest('div[data-dynamicform]').attr('data-dynamicform'));
        var id = $elem.attr('id');
        var newID = id;

        if (id !== undefined) {
            var matches = id.match(regexID);
            if (matches && matches.length === 4) {
                matches[2] = matches[2].substring(1, matches[2].length - 1);
                var identifiers = matches[2].split('-');
                identifiers[0] = index;

                if (identifiers.length > 1) {
                    var widgetsOptions = [];
                    $elem.parents('div[data-dynamicform]').each(function (i) {
                        widgetsOptions[i] = eval($(this).attr('data-dynamicform'));
                    });

                    widgetsOptions = widgetsOptions.reverse();
                    for (var i = identifiers.length - 1; i >= 1; i--) {
                        if (widgetsOptions[i]) {
                            identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                        }
                    }
                }

                newID = matches[1] + '-' + identifiers.join('-') + '-' + matches[3];
                $elem.attr('id', newID);
            } else {
                // Non-tabular IDs must stay stable across repeated updates.
                newID = id;
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
            var matches = name.match(regexName);

            if (matches && matches.length === 4) {
                matches[2] = matches[2].replace(/\]\[/g, "-").replace(/\]|\[/g, '');
                var identifiers = matches[2].split('-');
                identifiers[0] = index;

                if (identifiers.length > 1) {
                    var widgetsOptions = [];
                    $elem.parents('div[data-dynamicform]').each(function (i) {
                        widgetsOptions[i] = eval($(this).attr('data-dynamicform'));
                    });

                    widgetsOptions = widgetsOptions.reverse();
                    for (var i = identifiers.length - 1; i >= 1; i--) {
                        if (widgetsOptions[i]) {
                            identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                        }
                    }
                }

                name = matches[1] + '[' + identifiers.join('][') + ']' + matches[3];
                $elem.attr('name', name);
            }
        }

        return name;
    };

    var _updateAttributes = function (widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);

        $('.' + widgetOptionsRoot.widgetContainer).find(widgetOptionsRoot.widgetItem).each(function (index) {
            $(this).find('*').each(function () {
                // update "id" attribute
                _updateAttrID($(this), index);

                // update "name" attribute
                _updateAttrName($(this), index);
            });
        });
    };

    var _fixFormValidatonInput = function (widgetOptions, attribute, id, name) {
        if (attribute !== undefined) {
            attribute = $.extend(true, {}, attribute);
            attribute.id = id;
            attribute.container = ".field-" + id;
            attribute.input = "#" + id;
            attribute.name = name;
            attribute.value = $("#" + id).val();
            attribute.status = 0;

            if ($("#" + widgetOptions.formId).yiiActiveForm("find", id) !== undefined) {
                $("#" + widgetOptions.formId).yiiActiveForm("remove", id);
            }

            $("#" + widgetOptions.formId).yiiActiveForm("add", attribute);
        }
    };

    var _fixFormValidaton = function (widgetOptions) {
        var root = _getWidgetOptionsRoot(widgetOptions);
        if (!$('#' + root.formId).data('yiiActiveForm')) {
            return;
        }
        _removeValidations(root);
        $('.' + root.widgetContainer).find('input, textarea, select').each(function () {
            var id = $(this).attr('id');
            var name = $(this).attr('name');
            var attribute = id && (root.validationTemplates || {})[_validationKey(id)];
            if (attribute && name !== undefined) {
                _fixFormValidatonInput(root, attribute, id, name);
                root.validationIds.push(id);
            }
        });
    };

    var _restoreKrajeeDepdrop = function ($elem) {
        var configDepdrop = $.extend(true, {}, eval($elem.attr('data-krajee-depdrop')));
        var inputID = $elem.attr('id');
        var matchID = inputID.match(regexID);

        if (matchID && matchID.length === 4) {
            for (var index = 0; index < configDepdrop.depends.length; ++index) {
                var match = configDepdrop.depends[index].match(regexID);
                if (match && match.length === 4) {
                    configDepdrop.depends[index] = match[1] + matchID[2] + match[3];
                }
            }
        }
        $elem.depdrop(configDepdrop);
    };

    var _restoreSpecialJs = function (widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);
        var $items = $('.' + widgetOptionsRoot.widgetContainer).find(widgetOptionsRoot.widgetItem);

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
        var $hasDepdrop = $items.find('[data-krajee-depdrop]');
        if ($hasDepdrop.length > 0) {
            $hasDepdrop.each(function () {
                if ($(this).data('select2') === undefined) {
                    $(this).removeData().off();
                    $(this).unbind();
                    _restoreKrajeeDepdrop($(this));
                }
                var configDepdrop = eval($(this).attr('data-krajee-depdrop'));
                $(this).depdrop(configDepdrop);
            });
        }

        // "TomSelect"
        var $hasTomSelect = $items.find('select.tomselected');
        if ($hasTomSelect.length > 0 && typeof TomSelect !== 'undefined') {
            $hasTomSelect.each(function () {
                if (!this.tomselect) {
                    new TomSelect(this, {
                        plugins: ['remove_button', 'dropdown_input'],
                        width: '100%',
                        allowEmptyOption: true
                    });
                }
            });
        }

        // "kartik-v/yii2-widget-select2"
        var $hasSelect2 = $items.find('[data-krajee-select2]');
        if ($hasSelect2.length > 0) {
            $hasSelect2.each(function () {
                var id = $(this).attr('id');
                var configSelect2 = eval($(this).attr('data-krajee-select2'));
                $.when($('#' + id).select2(configSelect2)).done(initS2Loading(id));
                $('#' + id).on('select2-open', function () {
                    initSelect2DropStyle(id);
                });
                if ($(this).attr('data-krajee-depdrop')) {
                    $(this).on('depdrop.beforeChange', function (e, i, v) {
                        var configDepdrop = eval($(this).attr('data-krajee-depdrop'));
                        var loadingText = (configDepdrop.loadingText) ? configDepdrop.loadingText : 'Loading ...';
                        $('#' + id).select2('data', { text: loadingText });
                    });
                    $(this).on('depdrop.change', function (e, i, v, c) {
                        $('#' + id).select2('val', $('#' + id).val());
                    });
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
