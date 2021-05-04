
all: schemas package

schemas:
	cd arbttstats@gervasioperez.ar; glib-compile-schemas schemas

package:
	cd arbttstats@gervasioperez.ar; zip ../arbttstats@gervasioperez.ar-shell-extension.zip *.js *.css *.json helpers/* schemas/*
