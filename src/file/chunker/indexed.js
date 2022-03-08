function Indexed() {}

Object.defineProperties(Indexed, {
  prototype: {
    value: new Proxy(Object.prototype, {
      /**
       * @param {object} target
       * @param {PropertyKey} property
       * @param {{get(key:PropertyKey): any}} receiver
       */
      get(target, property, receiver) {
        return typeof property === "symbol"
          ? Reflect.get(target, property, receiver)
          : receiver.get(property)
      },
    }),
  },
})

export { Indexed }
