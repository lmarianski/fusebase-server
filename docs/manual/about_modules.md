# Introduction
Modules (also called "plugins") are an easy way to expand functionality of both the server and the client. They can also expand the control panel using "widgets" and other resources. For examples of modules have a look at [Examples](#)

# Regular Modules
Regular modules consist of a single file placed in the `/plugins/` directory. Each of them __must__ export an instance of the Module class. Given that this is a template for the most basic plugin:
```js
let Module = require("../src/server/api/Module.js");
let M = new Module();

module.exports = M;
```

For detailed options look at the reference of the [Module](https://lukas2005.github.io/FuseBase/class/api/Module.js~Module.html) class

# Widget/Advanced Modules
Advanced modules reside in a directory under `/plugins/`. They are made out of many files and have greater range of capabilities.

The name of the directory can be anything.
The name of the main `.js` file of the module __must__ be equal to the name of the directory or `main.js`.

To create control panel widgets create a file named `widgetN.pug` where N is a number from 0 to 9 (you can have multiple widgets). Support for adding full pages will be added soon. The Pug templating engine is used for the control panel but normal HTML works. You can create custom server side and client side scripts. When including one in your widget append `/#{module.name}/` before any path. This will allow for easy renaming of your module. The `module` variable is the same module instance that you exported in your main java script file. For better understanding of the Pug language see [Pug docs](https://pugjs.org/api/getting-started.html).

Anything you place in the `/plugins/ModuleName/` directory is served to the web on `http://server-ip:control-panel-port/ModuleName/`