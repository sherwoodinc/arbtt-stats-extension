/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
  Copyright (c) 2021, Gervasio Perez <sherwoodinc@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the GNOME nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

//'use strict'

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


function init() {
}

function addBoolean(i,title, sname, grid, settings) {
    // Create a label & switch 
    let label = new Gtk.Label({
        label: title,
        halign: Gtk.Align.START,
        visible: true
    });
    grid.attach(label, 0, i, 1, 1);

    let sw = new Gtk.Switch({
        active: settings.get_boolean(sname),
        halign: Gtk.Align.END,
        visible: true
    });
    grid.attach(sw, 1, i, 1, 1);
    
    // Bind the switch
    settings.bind(
        sname,
        sw,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
}

function addString(i, title, sname, grid, settings) {

    let label = new Gtk.Label({
        label: title,
        halign: Gtk.Align.START,
        visible: true
    });
    grid.attach(label, 0, i, 1, 1);
    
    let textbuffer = new Gtk.EntryBuffer({
        text: settings.get_string(sname)
    }

    );
    let text = new Gtk.Entry({
        buffer: textbuffer,
        halign: Gtk.Align.END,
        visible: true
    });
    grid.attach(text, 1, i, 1, 1);

    settings.bind(
            sname,
            textbuffer,
            'text',
            Gio.SettingsBindFlags.DEFAULT
    );
    
}

function addInteger(i, title, sname, grid, settings, adj = null) {

    let label = new Gtk.Label({
        label: title,
        halign: Gtk.Align.START,
        visible: true
    });
    grid.attach(label, 0, i, 1, 1);

    if (!adj)
      adj = new Gtk.Adjustment({
        value: settings.get_int (sname),
        lower: 1,
        upper: 9999999,
        step_increment: 60,
        page_increment: 5,
        page_size: 0}
        );

    let spin = new Gtk.SpinButton({
        adjustment: adj,
        value: settings.get_int(sname),
        halign: Gtk.Align.END,
        visible: true
    });
    grid.attach(spin, 1, i, 1, 1);
    
    // Bind the switch to the `show-indicator` key
    settings.bind(
        sname,
        spin,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );
}

function addChoices(i, title, sname, grid, settings, choices) {
    // Create a label & switch 
    let label = new Gtk.Label({
        label: title,
        halign: Gtk.Align.START,
        visible: true
    });
    grid.attach(label, 0, i, 1, 1);      
    
    let value = settings.get_string(sname);
    
    let drop = new Gtk.ComboBoxText({
        halign: Gtk.Align.END,
        visible: true    
    });
    choices.forEach((e) => {drop.append(e,e);});
    drop.set_active_id(value);
    
    grid.attach(drop, 1, i, 1, 1);
    settings.bind(
        sname,
        drop,
        'active-id',
        Gio.SettingsBindFlags.DEFAULT
    );    
}


function buildPrefsWidget() {

    // Copy the same GSettings code from `extension.js`
    this.settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.arbttstats');

    // Create a parent widget that we'll return from this function
    let prefsWidget = new Gtk.Grid({
        column_spacing: 12,
        row_spacing: 12,
        hexpand: true,
        visible: true
    });

    // Add a simple title and add it to the prefsWidget
    let title = new Gtk.Label({
        label: `<b>${Me.metadata.name} Preferences</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    prefsWidget.attach(title, 0, 0, 2, 1);

    let i = 1;
    addInteger(i++, 'Refresh interval (s)', 'refresh-interval-seconds', prefsWidget, settings);
    addChoices(i++, 'Number of top events to show', 'events-to-fetch', prefsWidget, settings, ["1", "3", "5", "10"]);
    addBoolean(i++, 'Strip category name from tags', 'strip-category-names', prefsWidget, settings);
    addBoolean(i++, 'Ignore inactive entries', 'ignore-inactive', prefsWidget, settings);
    addString(i++, 'Excluded categories (comma separated)', 'excluded-categories', prefsWidget, settings);
    addString(i++, 'Included categories (comma separated)', 'included-categories', prefsWidget, settings);
    addChoices(i++, 'Stats interval', 'stats-interval', prefsWidget, settings, ['current day', 'current week', 'current month']);
    addChoices(i++, 'Week start day', 'week-start-day', prefsWidget, settings, ['Monday' , 'Sunday']);
    addString(i++, 'Log file full path', 'log-file-path', prefsWidget, settings);
    addString(i++, 'Categorize rules file full path', 'categorize-file-path', prefsWidget, settings);
    let button = new Gtk.Button({
      label: "Edit categorize file",
    });
    
    let file = settings.get_string("categorize-file-path");
    let handler = function() { Me.imports.helpers.arbttlib.categories_file_open(file); };
    prefsWidget._button_handler = button.connect("clicked", handler);
    prefsWidget.attach(button,0, i++, 2,1);

    // Return our widget which will be added to the window
    return prefsWidget;
}
