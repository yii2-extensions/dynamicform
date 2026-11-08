import { field, hiddenInput, requiredAttribute, textInput, widgetOptions } from './markup.js';

/**
 * Two nested widgets (houses containing rooms) in one form, the README's nested example, and a three-level form.
 */
function room(house, index, name = '') {
  const id = `room-${house}-${index}-name`;

  return `<div class="room">${field(id, 'Room', textInput(id, `Room[${house}][${index}][name]`, name))}<button type="button" class="remove-room">x</button></div>`;
}

function house(index, name, rooms) {
  const id = `house-${index}-name`;

  return (
    `<div class="house">${field(id, 'House', textInput(id, `House[${index}][name]`, name))}` +
    `<div class="dynamicform_inner" data-dynamicform="dynamicform_rooms"><div class="rooms">${rooms
      .map((name, roomIndex) => room(index, roomIndex, name))
      .join('')}</div><button type="button" class="add-room">Add room</button></div>` +
    '<button type="button" class="remove-house">x</button></div>'
  );
}

/**
 * `rooms` are the rooms of the first house, whose markup becomes the outer template; `otherHouses` lists further
 * `[name, rooms]` houses rendered after it.
 */
export function nestedForm({ rooms = ['r00'], otherHouses = [] } = {}) {
  const firstHouse = house(0, 'h0', rooms);
  const others = otherHouses.map(([name, houseRooms], index) => house(index + 1, name, houseRooms)).join('');

  return {
    html:
      '<form id="nested-form"><div class="dynamicform_outer" data-dynamicform="dynamicform_houses">' +
      `<div class="houses">${firstHouse}${others}</div><button type="button" class="add-house">Add house</button></div></form>`,
    widgets: {
      dynamicform_houses: widgetOptions({
        widgetContainer: 'dynamicform_outer',
        widgetBody: '.houses',
        widgetItem: '.house',
        insertButton: '.add-house',
        deleteButton: '.remove-house',
        formId: 'nested-form',
        fields: [{ id: 'house-{}-name', name: 'House[{}][name]' }],
        template: firstHouse,
      }),
      dynamicform_rooms: widgetOptions({
        widgetContainer: 'dynamicform_inner',
        widgetBody: '.rooms',
        widgetItem: '.room',
        insertButton: '.add-room',
        deleteButton: '.remove-room',
        formId: 'nested-form',
        fields: [{ id: 'room-{}-{}-name', name: 'Room[{}][{}][name]' }],
        template: room(0, 0, 'r00'),
      }),
    },
    validation: {
      'nested-form': [
        requiredAttribute('house-0-name', '[0]name', 'House cannot be blank.'),
        ...rooms.map((_room, index) =>
          requiredAttribute(`room-0-${index}-name`, `[0][${index}]name`, 'Room cannot be blank.'),
        ),
      ],
    },
  };
}

/**
 * Three nested widgets (sections, groups, lines) in one form: section 0 holds the groups `[a]` and `[b, c]`, section 1
 * the group `[d]`. A line holds the declared `Line[2024][s][g][l][name]`, whose literal key `2024` only the declared
 * pattern tells apart from the row indexes; the first line of a group also holds the undeclared `Note[s][g][ts]`, whose
 * model prefix no widget declares and which carries the section and group indexes only.
 */
export function threeLevelForm() {
  const line = (s, g, l, value) =>
    `<div class="line">${textInput(`line-2024-${s}-${g}-${l}-name`, `Line[2024][${s}][${g}][${l}][name]`, value)}` +
    `${l === 0 ? hiddenInput(`note-${s}-${g}-ts`, `Note[${s}][${g}][ts]`, `n${s}${g}`) : ''}</div>`;
  const group = (s, g, values) =>
    `<div class="group"><div class="dynamicform_lines" data-dynamicform="dynamicform_lines"><div class="lines">${values.map((value, l) => line(s, g, l, value)).join('')}</div></div></div>`;
  const section = (s, groups) =>
    `<div class="section"><div class="dynamicform_groups" data-dynamicform="dynamicform_groups"><div class="groups">${groups.map((values, g) => group(s, g, values)).join('')}</div></div></div>`;
  const level = (container, body, item, template, fields = []) =>
    widgetOptions({ widgetContainer: container, widgetBody: `.${body}`, widgetItem: `.${item}`, formId: 'three-level-form', fields, template });

  return {
    html: `<form id="three-level-form"><div class="dynamicform_sections" data-dynamicform="dynamicform_sections"><div class="sections">${section(0, [['a'], ['b', 'c']])}${section(1, [['d']])}</div></div></form>`,
    widgets: {
      dynamicform_sections: level('dynamicform_sections', 'sections', 'section', section(0, [['a'], ['b', 'c']])),
      dynamicform_groups: level('dynamicform_groups', 'groups', 'group', group(0, 0, ['a'])),
      dynamicform_lines: level('dynamicform_lines', 'lines', 'line', line(0, 0, 0, 'a'), [
        { id: 'line-2024-{}-{}-{}-name', name: 'Line[2024][{}][{}][{}][name]' },
      ]),
    },
    validation: { 'three-level-form': [] },
  };
}

export const houses = () => document.querySelectorAll('.houses > .house');
export const roomsOf = (houseIndex) => houses()[houseIndex].querySelectorAll('.rooms > .room');
export const inputs = () =>
  Array.from(document.querySelectorAll('#nested-form input'), (input) => `${input.id}|${input.name}`);
