onmessage = (_, __ = {}) => {
    __[101] = [];
    try {
        console.info = console.warn = console.error = console.log = (...a) => __[101].push(a);
        __[102] = eval(_.data[1]);
        postMessage([_.data[0], __[102]]);
    } catch (e) {
        postMessage([_.data[0], e]);
    }
};