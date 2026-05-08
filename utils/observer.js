// utils/observer.js

let observers = [];

function subscribe(observerFn) {
  observers.push(observerFn);
}

function notifyAll(data) {
  observers.forEach(fn => fn(data));
}

module.exports = {
  subscribe,
  notifyAll
};
