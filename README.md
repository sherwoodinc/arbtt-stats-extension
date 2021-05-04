# arbttstats-extension
Simple gnome shell widget for Arbtt daily/weekly/monthly stats

Features
--------

- View time spent in each tag configured in Arbtt
- Inspect top entries in each tag category, and generate (commented) rules from them in the `categorize.cfg` file
- Edit the categories file 

Mini Arbtt tutorial
-------------------

- Install arbtt, and make sure `arbtt-capture` is run at login
- Let it collect data for at least a couple of days
- Start with this `~/.arbtt/categorize.cfg` minimal file:
```hs
$idle > 60 ==> tag inactive,

-- Catch all rule, should be the last rule in this file
current window $title =~ /.*/ ==> tag Category:Uncategorized,
```
- Play with this extension to find out how you spend your time:
  * open up the "Uncategorized" category and click on the first (most frequent) item of the list
  * this will append to `categorize.cfg` four example rules based on that item, and will open your default text edit
  * edit and customize the rules to provide a meaningful Category:Tag name
  * keep the "Category:Uncategorized" rule as the last rule in the file

See [https://arbtt.nomeata.de/doc/users_guide/configuration.html] for a comprehensive introduction.
