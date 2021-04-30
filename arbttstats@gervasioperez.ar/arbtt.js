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

const Gettext = imports.gettext;
const { Gio, GLib } = imports.gi;

/* arbtt-stats options -- for self reference
-h, -?       --help                  show this help
-V           --version               show the version number
            --logfile=FILE          use this file instead of ~/.arbtt/capture.log
            --categorizefile=FILE   use this file instead of ~/.arbtt/categorize.cfg
-x TAG       --exclude=TAG           ignore samples containing this tag or category
-o TAG       --only=TAG              only consider samples containing this tag or category
            --also-inactive         include samples with the tag "inactive"
-f COND      --filter=COND           only consider samples matching the condition
-m PERC      --min-percentage=PERC   do not show tags with a percentage lower than PERC% (default: 1)
            --output-exclude=TAG    remove these tags from the output
            --output-only=TAG       only include these tags in the output
-i           --information           show general statistics about the data
-t           --total-time            show total time for each tag
-c CATEGORY  --category=CATEGORY     show statistics about category CATEGORY
            --each-category         show statistics about each category found
            --intervals=TAG         list intervals of tag or category TAG
            --dump-samples          Dump the raw samples and tags.
            --output-format=FORMAT  one of: text, csv (comma-separated values), tsv (TAB-separated values) (default: Text)
            --for-each=PERIOD       one of: day, month, year

 */

function build_arbtt_command_line(settings) {
  let cmdline = ["arbtt-stats", "--output-format=csv"];
  try {    
    let today = GLib.DateTime.new_now_local().format("\%F");
    if (!settings.ignore_inactive) cmdline.push("--also-inactive");
    if (settings.logs_path.length > 0) cmdline.push("--logfile=" + settings.logs_path);
    if (settings.categorize_path.length > 0) cmdline.push("--categorizefile=" + settings.categorize_path);

    for (let i = 0; i < settings.included_categories.length; ++i) cmdline.push("--category=" + settings.included_categories[i]);
    if (settings.excluded_categories.length > 0)
      for (let i = 0; i < settings.excluded_categories.length; ++i) cmdline.push("--exclude=" + settings.excluded_categories[i]);
      
    switch (settings.stats_interval) {
      case "current day": break;
      case "current week":
        today = GLib.DateTime.new_now_local();
        today = today.add_days(-today.get_day_of_week());
        if (settings.week_start_day == "Monday") today = today.add_days(1);
        today = GLib.DateTime.new_local(today.get_year(), today.get_month(), today.get_day_of_month(), 0, 0, 0);
        today = today.format("\%F");
        break;
      case "current month":
        today = GLib.DateTime.new_now_local();
        today = GLib.DateTime.new_local(today.get_year(), today.get_month(), 1, 0, 0, 0);
        today = today.format("\%F");
        break;
     };
     
     cmdline.push("--filter='$date>=" + today + "'");
  } catch (e) { 
    log(e);
  }
  
  return cmdline;
}

function parse_arbtt_csv_output(categories_csv) {
  let categories = [];
  try {
    categories_csv = categories_csv.split("\n");
    let i = 0;
    for (i = 0; i < categories_csv.length; ++i) {
      if (categories_csv[i].length > 1) {
        categories_csv[i] = categories_csv[i].split(',');
      }
      else
        categories_csv[i] = [];
    }

    for (i = 1; i < categories_csv.length; ++i) {
      if (categories_csv[i].length > 0) {
        let v = {};
        for (let j = 0; j < categories_csv[0].length; ++j)
          v[categories_csv[0][j]] = categories_csv[i][j];

        let c = {
          tag: v["Tag"].split(":"),
          category: v["Tag"].split(":")[0],
          percentage: parseFloat(v["Percentage"]),
          time: v["Time"],
          time_hms: v["Time"].split(":").map((v) => { return parseInt(v); }),
        };
        c.tag = c.tag[c.tag.length - 1];
        c.time_minutes = c.time_hms[0] * 60 + c.time_hms[1];
        c.time_hm_str = (c.time_hms[0] > 0 ? c.time_hms[0].toString() + "h" : "") +
          (c.time_hms[1] > 0 ? c.time_hms[1].toString() + "m" : "");
        categories.push(c);        
      }
      
    }
  } catch (e) {
    // return empty category list on error
    log(e);
  }
  return categories;
}

function read_arbtt_stats(settings) {
  let argv = build_arbtt_command_line(settings);
  let categories_csv = imports.byteArray.toString(GLib.spawn_command_line_sync(argv.join(" "))[1]);
  let categories = parse_arbtt_csv_output(categories_csv);
  return categories;
}

