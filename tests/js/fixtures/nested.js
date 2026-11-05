import { field, requiredAttribute, textInput, widgetOptions } from './markup.js';

/**
 * Two nested widgets (houses containing rooms) in one form, the README's nested example.
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

export function nestedForm({ rooms = ['r00'] } = {}) {
  const firstHouse = house(0, 'h0', rooms);

  return {
    html:
      '<form id="nested-form"><div class="dynamicform_outer" data-dynamicform="dynamicform_houses">' +
      `<div class="houses">${firstHouse}</div><button type="button" class="add-house">Add house</button></div></form>`,
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

export const houses = () => document.querySelectorAll('.houses > .house');
export const roomsOf = (houseIndex) => houses()[houseIndex].querySelectorAll('.rooms > .room');
export const inputs = () =>
  Array.from(document.querySelectorAll('#nested-form input'), (input) => `${input.id}|${input.name}`);
