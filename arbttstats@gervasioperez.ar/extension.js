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

const GETTEXT_DOMAIN = "arbtt-stats";

const { GObject, St, Gio, GLib, Gtk, Clutter } = imports.gi;

const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const CE = ExtensionUtils.getCurrentExtension();
const extensionPath = CE.path;

const Arbtt = CE.imports.helpers.arbttlib;

function log_status() {
  logfile = Gio.file_new_for_path(
    GLib.get_user_cache_dir() + "/arbttstats-extension.log"
  );

  let fileOutput = logfile.append_to(Gio.FileCreateFlags.PRIVATE, null);
  if (!arguments[0]) fileOutput.write("\n", null);
  else
    fileOutput.write(
      "[" + new Date().toString() + "] " + arguments[0] + "\n",
      null
    );
  fileOutput.close(null);
  return 0;
}

var PopupBarMenuItem = GObject.registerClass(
  class PopupBarMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init(settings, cat) {
      let task = cat.tag;
      if (!settings.strip_categories) task = cat.raw_tag;

      this._category = cat;
      this._settings = settings;
      let text = cat.time_hm_str + " -- " + task;
      let xwidth = Math.floor(cat.percentage) * 2;

      super._init(text, false);

      this._separator = new St.Widget({
        style_class: "arbtt-stats-progress-bar",
        width: xwidth,
        x_expand: false,
        x_align: Clutter.ActorAlign.START,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this._separator);

      // override menu open
      let _open = this.menu.open.bind(this.menu);
      let parent = this;
      this.menu.open = function (activate) {
          parent.get_events(_open, activate);
      }.bind(this.menu);
    }

    get_events(fn, activate) {
      log("Fetching events for " + this._category.raw_tag);
      this.menu.removeAll();
      let icon = new St.Icon({
        icon_name: "emblem-synchronizing-symbolic",
        style_class: "system-status-icon",
        icon_size: 16
      });
      this.add_child(icon);
      Arbtt.fetch_arbtt_entries_for_tag(
        this._settings,
        this._category.raw_tag
      ).then((events) => {
        events.forEach((e) => {
          let item = new PopupMenu.PopupMenuItem(
            "[" + e.frequency.toString() + "] " + e.program + " -- " + e.title
          );
          item.connect(
            "activate",
            function () {
              Arbtt.build_rule_templates_from_event(this._settings, e);
            }.bind(this)
          );
          this.menu.addMenuItem(item);
        });
        this.remove_child(icon);
        fn(activate);
      });
    }

    process_event(event) {}
  }
);

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    open_prefs() {
      GLib.spawn_command_line_async(
        "gnome-extensions prefs arbttstats@gervasioperez.ar"
      );
    }

    toggle_stats_interval() {
      this._item.add_child(new St.Icon({
        icon_name: "emblem-synchronizing-symbolic",
        style_class: "system-status-icon",
        icon_size: 16
      }));
      this._parent.toggle_stats_interval();
    }

    refresh(settings) {
      Arbtt.read_arbtt_stats(settings).then((categories) => {
      this.menu.removeAll();
      try {
        let totalTime = 0;
        let interval_text = "Today";
        switch (settings.stats_interval) {
          case "current week":
            interval_text = "This week";
            break;
          case "current month":
            interval_text = "This month";
            break;
        }

        let icon = new St.Icon({
          icon_name: "x-office-calendar-symbolic",
          style_class: "system-status-icon",
        });
        this._item = new PopupMenu.PopupImageMenuItem(interval_text, icon.gicon);
        this._item.activate = this.toggle_stats_interval.bind(this);
        this.menu.addMenuItem(this._item);

        categories.forEach((c) => {
          totalTime += c.time_minutes;
          let item = new PopupBarMenuItem(settings, c);
          this.menu.addMenuItem(item);
        });

        totalTime =
          (totalTime > 60 ? Math.floor(totalTime / 60).toString() + "h" : "") +
          (totalTime % 60).toString() +
          "m";

        let item = new PopupMenu.PopupMenuItem("Logged time: " + totalTime);
        this.menu.addMenuItem(item, 1);

        icon = new St.Icon({
          icon_name: "emblem-system-symbolic",
          style_class: "system-status-icon",
        });
        item = new PopupMenu.PopupImageMenuItem("Configure", icon.gicon);
        item.connect("activate", this.open_prefs);
        this.menu.addMenuItem(item);

        icon = new St.Icon({
          icon_name: "document-edit-symbolic",
          style_class: "system-status-icon",
        });

        item = new PopupMenu.PopupImageMenuItem("Edit categories", icon.gicon);
        item.connect("activate", function () {
          Arbtt.categories_file_open(settings.categorize_path);
        });
        this.menu.addMenuItem(item);
      } catch (e) {
        log(e);
      }
      });
    }

    _init(parent) {
      super._init(0.0, _("Arbtt Stats"));
      this._parent = parent;

      let box = new St.BoxLayout({ style_class: "panel-status-menu-box" });
      box.add_child(
        new St.Icon({
          icon_name: "emblem-urgent",
          style_class: "system-status-icon",
        })
      );
      this.add_child(box);
    }
  }
);

class Extension {
  constructor(uuid) {
    this._uuid = uuid;
    this.timer = null;
    this._busy = false;
    ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
  }

  busy() { return this._busy; }

  async toggle_stats_interval() {
    this._busy = true;
    try {      
      let result = "";
      switch (this.settings.get_string("stats-interval")) {
        case "current day":
          result = "current week";
          break;
        case "current week":
          result = "current month";
          break;
        case "current month":
          result = "current day";
          break;
      }
      this.settings.set_string("stats-interval", result);
      this.refresh();      
    } catch (e) {
      log(e);
    }
    this._busy = false;
  }

  /* Async refresh method to call in sdsdddddddd */
  async refresh_async() {
    await this.refresh();
  }

  /* Main refresh method is synchronous to support active toggling of stat intervals */
  refresh() {
    this._busy = true;
    log_status("Refreshing arbtt stats...");
    try {
      var settings = {
        interval: this.settings.get_int("refresh-interval-seconds"),
        strip_categories: this.settings.get_boolean("strip-category-names"),
        logs_path: this.settings.get_string("log-file-path"),
        categorize_path: this.settings.get_string("categorize-file-path"),
        ignore_inactive: this.settings.get_boolean("ignore-inactive"),
        included_categories: this.settings.get_string("included-categories"),
        excluded_categories: this.settings.get_string("excluded-categories"),
        stats_interval: this.settings.get_string("stats-interval"),
        week_start_day: this.settings.get_string("week-start-day"),
        events_to_fetch: parseInt(this.settings.get_string("events-to-fetch")),
      };
      if (settings.included_categories.length > 0)
        settings.included_categories = settings.included_categories.split(",");
      else settings.included_categories = [];
      if (settings.excluded_categories.length > 0)
        settings.excluded_categories = settings.excluded_categories.split(",");
      else settings.excluded_categories = [];
      this._indicator.refresh(settings);
      if (this.timer) {
        GLib.source_remove(this.timer);
      }
      this.timer = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        settings.interval * 1000,
        async function () {
          this._update();
          return true;
        }.bind(this));
    } catch (e) {
      //
      log(e);
    }
    this._busy = false;
  }

  enable() {
    this.settings = ExtensionUtils.getSettings(
      "org.gnome.shell.extensions.arbttstats"
    );

    if (!this._indicator) {
      this._indicator = new Indicator(this);
      Main.panel.addToStatusArea(this._uuid, this._indicator);
    }
    this.refresh();
  }

  disable() {
    if (this.timer) GLib.source_remove(this.timer);
    this.timer = null;
    this.settings = null;
    if (this._indicator) this._indicator.destroy();
    this._indicator = null;
  }

  async _update() {
    if (!this._indicator) {
      this._indicator = new Indicator(this);
      Main.panel.addToStatusArea(this._uuid, this._indicator);
    }
    this.refresh_async();
  }
}
function init(meta) {
  return new Extension(meta.uuid);
}
