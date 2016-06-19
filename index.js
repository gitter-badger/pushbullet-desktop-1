'use strict';

// Module to control application life.
const { app, BrowserWindow, Tray, Menu, shell, dialog, ipcMain } = require('electron');

const path = require('path'),
    storage = require('electron-json-storage'),
    _ = require('lodash');

const platform = require('./app/scripts/platform');

const DEFAULT_WIDTH = 1024,
    DEFAULT_HEIGHT = 700;


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow,
    mainPage,
    sysTray;

let appUrl = 'file://' + __dirname + '/app/index.html',
    appName = app.getName();

let appIcon = path.join(__dirname, 'icons', platform.type, 'app-icon' + platform.icon(platform.type));

let trayIconDefault = path.join(__dirname, 'icons', platform.type, 'icon-tray' + platform.image(platform.type)),
    trayIconActive = path.join(__dirname, 'icons', platform.type, 'icon-tray-active' + platform.image(platform.type));



var settingsStore = storage,
    settingsDefault = {
        dock: true,
        notifyAfter: 0,
        version: app.getVersion()
    },
    settings = {};


/**
 * Logger
 */
let log = function() {
    var args = Array.from(arguments),
        textList = [];

    for (let value of args) {
        if (_.isPlainObject(value)) {
            textList.push('\r\n' + JSON.stringify(value, null, 4) + '\r\n');
        } else {
            textList.push(value);
        }
    }
    console.log('[module:' + path.basename(__filename) + ']', textList.join(' '));
};


/**
 * Error Handler
 * @param {String} message - Error Message
 */
var handleError = function(message) {
    dialog.showMessageBox({
        type: 'warning',
        icon: appIcon,
        buttons: ['Dismiss'],
        defaultId: 0,
        title: 'Error',
        message: 'Error',
        detail: message || 'Error'
    });
};


/**
 * Dock: Set Visibility
 *
 * @param {Boolean} doShow - True to show the Dock, false to hide it
 */
var setDockVisibility = function(doShow) {
    if (doShow === true) {
        if (platform.isOSX) {
            app.dock.show();
        } else {
            mainWindow.show();
        }
    } else {
        if (platform.isOSX) {
            app.dock.hide();
        } else {
            mainWindow.hide();
        }
    }
    settings.dock = doShow;
};


/**
 * Dock: Toggle Visibility
 */
var toggleDock = function() {
    if (settings.dock !== null && settings.dock === true) {
        setDockVisibility(false);
    } else {
        setDockVisibility(true);
    }
};


/**
 * Settings: Store to file
 */
var storeSettings = function(callback) {
    settingsStore.set('settings', settings, function(error) {
        if (error) {
            return handleError(error);
        }

        log('[storeSettingsProperty]', 'settings', settings);

        callback();
    });
};


/**
 * Add new property to settings
 *
 * @param {String} property - Property Name
 * @param {*=} value - Initial Value
 */
var initSettingsProperty = function(property, value) {
    var initialValue = value || null;
    if (settings.hasOwnProperty(property)) {
        return;
    }
    settings[property] = initialValue || null;

    log('[initSettingsProperty]', 'property', property, 'initialValue', initialValue, 'settingsDefaults[property]', settings[property]);
};


/**
 * Get value of global settings property. Create property if it does not exist.
 * @param {String} property - Property Name
 * @param {String} value - Value
 */
var getSettingsProperty = function(property) {
    if (typeof property === 'undefined') {
        return settings;
    }

    log('[getSettingsProperty]', 'property', property, 'configDefaults[property]', settings[property]);
    return settings[property];
};


var setSettingsProperty = function(property, value, callback) {
    if (typeof property === 'undefined') {
        return false;
    }
    settings[property] = value;

    log('[setSettingsProperty]', 'property', property, 'value', value);

    storeSettings(callback);
    // return settings[property];
};



/**
 * IPC Event Handlers
 */
ipcMain.on('notification-received', () => {
    sysTray.setImage(trayIconActive);
});

ipcMain.on('notification-click', (event, options) => {
    var url = options.url;
    if (url) {
        return shell.openExternal(url);
    }

    mainWindow.show();
});

ipcMain.on('error-show', (event, message) => {
    handleError(message);
});

ipcMain.on('settings-get', (event, property) => {
    log('[settings-get]', 'property', property);

    if (!settings.hasOwnProperty(property)) {
        initSettingsProperty(property);
    }
    event.sender.send('settings-get-reply', getSettingsProperty(property));
});

ipcMain.on('settings-set', (event, property, value) => {
    log('[settings-set]', 'property', property, 'value', value);

    setSettingsProperty(property, value, function() {
        event.sender.send('settings-set-reply', property, value);
    });
});



/**
 * App
 */
var windowOptions = {
    // Style
    icon: appIcon,
    title: appName,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    show: false,
    center: true,
    webPreferences: {
        nodeIntegration: true,
        allowDisplayingInsecureContent: true,
        experimentalFeatures: true,
        allowRunningInsecureContent: true,
        webSecurity: false
    }
};

app.on('before-quit', () => {
    mainWindow.forceClose = true;
});

app.on('quit', () => {
    storeSettings();
});

app.on('activate', () => {
    mainWindow.show();
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (platform.type !== 'darwin') {
        app.quit();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {

    // Load Settings from file
    settingsStore.get('settings', function(error, result) {
        if (error) { return handleError(error); }

        // Commit Settings
        settings = result;
        _.defaults(settings, settingsDefault);
        log('[settingsStore.get]', 'result:', result, 'settings:', settings);

        // Init Tray
        sysTray = new Tray(trayIconDefault);
        sysTray.setImage(trayIconDefault);
        sysTray.setToolTip(appName);
        sysTray.setContextMenu(Menu.buildFromTemplate([
            { label: 'Open', click() { mainWindow.show(); } },
            { type: 'separator' },
            { label: 'Hide Application Window', type: 'checkbox', checked: !settings.dock, click() { toggleDock(); } },
            { label: 'Quit', click() { app.quit(); } }
        ]));

        // Create the browser window.
        mainWindow = new BrowserWindow(windowOptions);

        setDockVisibility(settings.dock);

        // and load the index.html of the app.
        mainWindow.loadURL(appUrl);

        // Emitted when the window is closed.
        mainWindow.on('closed', () => {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            mainWindow = null;
        });

        mainWindow.on('focus', () => {
            sysTray.setImage(trayIconDefault);
        });

        mainWindow.on('close', ev => {
            if (mainWindow.forceClose) {
                return;
            }
            ev.preventDefault();
            mainWindow.hide();
        });

        mainPage = mainWindow.webContents;

        mainPage.on('will-navigate', (event, url) => {
            event.preventDefault();
            open(url);
        });

        mainPage.on('dom-ready', () => {
            mainWindow.show();
            mainWindow.center();
        });

        // Create the Application's main menu
        var template = [{
            label: 'Application',
            submenu: [
                { label: 'About Application', selector: 'orderFrontStandardAboutPanel:' },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'Command+Q', click: function() { app.quit(); } }
            ]
        }, {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
            ]
        }, {
            label: 'Developer',
            submenu: [
                {
                    label: 'Web Inspector', accelerator: 'Command+D',
                    click: function() { mainWindow.openDevTools(); }
                }
            ]
        }];

        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    });
});
