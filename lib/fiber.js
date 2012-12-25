Function.prototype.async = function async() {
    setTimeout.bind(null, this, 0).apply(null, arguments);
};

var Fiber = (function FiberManager() {
    var {defineProperties, prototype} = Object;
    var classOf = Function.prototype.call.bind(prototype.toString);
    var currentDescriptor = null;
    var runQueue = [];

    var continuation = Fiber.continuation = {};
    var cooperation = Fiber.cooperation = {};
    var suspension = Fiber.suspension = {};
    Fiber.currentFiber = currentFiber;
    Fiber.prototype.run = run;
    Fiber.sleep = sleep;

    return Fiber;

    function sleep(ms) {
        var callback = yield continuation;
        setTimeout(callback, ms);
        yield suspension;
    }

    function run() {
        throw new Error("Running a fiber with an unspecified target.");
    }

    function currentFiber() {
        return currentDescriptor ? currentDescriptor.fiber : null;
    }

    function Fiber(target) {
        var descriptor = new FiberDescriptor(this);

        this.start = start;

        function start() {
            if (descriptor.state === "created") {
                var context = null;

                switch (typeof target) {
                case "undefined":
                    target = this;
                case "object":
                    context = target;
                    target = context.run;

                    if (typeof target !== "function") {
                        descriptor.kill();
                        throw new Error("The target must have a method named run.");
                    }
                case "function":
                    try {
                        target = target.call(context);
                    } catch (error) {
                        descriptor.kill();
                        throw error;
                    }

                    break;
                default:
                    descriptor.kill();
                    throw new Error("The target must be a function or must have a method named run.");
                }

                if (classOf(target) === "[object Generator]") {
                    descriptor.target = target;
                    enqueue(descriptor);
                } else descriptor.kill();
            } else throw new Error("The fiber has already been started.");
        }
    }

    function FiberDescriptor(fiber) {
        var descriptor = this;
        var waitQueue = [];
        fiber.join = join;

        descriptor.fiber = fiber;
        descriptor.cooperate = true;
        descriptor.run = schedule.bind(descriptor);
        descriptor.state = "created";
        descriptor.priority = 0;
        descriptor.kill = kill;

        defineProperties(fiber, {
            state: {
                get: getState
            },
            priority: {
                get: getPriority,
                set: setPriority
            }
        });

        function join(ms) {
            if (this.state !== "zombied") {
                var callback = yield continuation;
                if (ms) setTimeout(notify, ms);
                waitQueue.push(notify);
                var recall = true;
                yield suspension;
            }

            function notify() {
                if (recall) {
                    recall = false;
                    callback();
                }
            }
        }

        function getState() {
            return descriptor.state;
        }

        function getPriority() {
            return descriptor.priority;
        }

        function setPriority(number) {
            if (+number === number) descriptor.priority = number;
            else throw new Error("The priority of the fiber must be a number.");
        }

        function kill() {
            this.state = "zombied";
            var length = waitQueue.length;
            for (var i = 0; i < length; i++)
                waitQueue[i].call();
        }
    }

    function enqueue(descriptor) {
        descriptor.state = "waiting";
        var i = runQueue.push(descriptor) - 1;

        for (var j = 0; j < i; j++) {
            var a = runQueue[i];
            var b = runQueue[j];

            if (a.priority > b.priority)
                [runQueue[i], runQueue[j]] = [b, a];
        }

        if (!currentDescriptor) switchContext();
    }

    function switchContext() {
        if (runQueue.length) {
            currentDescriptor = runQueue.shift();
            var value = currentDescriptor.value;
            currentDescriptor.state = "running";
            currentDescriptor.run.async(value);
        } else currentDescriptor = null;
    }

    function schedule() {
        var callStack = [];
        var descriptor = this;
        descriptor.run = jump;

        jump(descriptor.target);

        function jump(value) {
            try {
                loop: while (true) {
                    switch (classOf(value)) {
                    case "[object Generator]":
                        callStack.push(value);
                        value = value.next();
                        break;
                    case "[object Error]":
                        callStack.pop().close();
                        var length = callStack.length;
                        if (length) value = callStack[--length].throw(value);
                        else throw value;
                        break;
                    default:
                        switch (value) {
                        case continuation:
                            var length = callStack.length;
                            value = callStack[--length].send(callback);
                            break;
                        case cooperation:
                            var {cooperate} = descriptor;
                            descriptor.cooperate = !cooperate;

                            if (cooperate) {
                                currentDescriptor = null;
                                descriptor.value = value;
                                enqueue(descriptor);
                                break loop;
                            } else {
                                var length = callStack.length;
                                value = callStack[--length].next();
                                break;
                            }
                        case suspension:
                            descriptor.state = "blocked";
                            switchContext();
                            break loop;
                        default:
                            callStack.pop().close();
                            var length = callStack.length;
                            if (length) value = callStack[--length].send(value);
                            else {
                                descriptor.kill();
                                switchContext();
                                break loop;
                            }
                        }
                    }
                }
            } catch (error) {
                descriptor.kill();
                if (error === StopIteration) switchContext();
                else {
                    currentDescriptor = null;
                    var {name, message} = error;
                    var stack = error.stack || "";
                    console.log(name + ": " + message + "\n" + stack);
                }
            }
        }

        function callback(value) {
            if (descriptor.state === "blocked") {
                descriptor.value = value;
                enqueue(descriptor);
            } else throw new Error("The fiber is not blocked.");
        }
    }
}());

if (typeof module === "object") module.exports = Fiber;

(function boot(module, args) {
    var {main} = module;
    new Fiber(function load() {
        if (typeof main === "function") var exit = main(args);
        if (exit) yield new Error(exit);
    }).start();
}.async(typeof require === "function" ? require(require.main.id) : this,
        typeof arguments !== "undefined" ? arguments : []));
