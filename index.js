var fs = require('fs');
var zlib = require('zlib');
var request = require('request');
var argv = require('minimist')(process.argv.slice(2));
var osmium = require('osmium');
var sqlite = require('sqlite3').verbose();
var step = require('step');

var db = new sqlite.Database('changes.sqlite');
db.run(
    'CREATE TABLE IF NOT EXISTS points(lon float, lat float, timestamp bigint)'
);

// bbox always in w,s,e,n
var bbox = {
    w: -122.51781,
    e: -122.34924,
    s: 37.716045,
    n: 37.817006
}

// plumbing
var log = console.log;
var out = process.stdout;

//console.log(argv);

var start = argv._[0];
var end = argv._[1];
var rels = [];

for (var day = start; day <= end; day++) {
    var xml = day + '.xml';
    var gj = day + '.geojson';

    readosm(xml, gj);
    /*
    step(
        function () {
            getdata(xml, this);
        },
        function (err, xml, gj) {
            if (err) throw err;
            readosm(xml, gj);
        }
    );
    /**/
}

function getdata(xml) {
    if (!fs.existsSync(xml)) {

        var options = {
            uri: 'http://planet.openstreetmap.org/replication/day/000/000/' + day + '.osc.gz'
        }

            var writeXML = fs.createWriteStream(xml);

            request(options)
                .on('error', log)
                .pipe(zlib.createGunzip())
                .pipe(writeXML);

        console.log('Downloading ', xml);
    } else {
        console.log(xml + " already exists, skipping download")
    }
}

function readosm (xml, gj) {
    //var geojson = { "type": "FeatureCollection", "features": [] }

    // osmium things
    var file = new osmium.File(xml)
    var relreader = new osmium.Reader(file, { relation:true });
    var handler = new osmium.Handler();
/*
*/
    handler.on('relation',function(relation) {
        // if (err) throw err.message;
        if (relation.tags().type == 'restriction') {
            //console.log(relation.members()[0].wkt());
            var geom = {
                id: relation.id,
                ts: relation.timestamp,
                ways: [],
                nodes: [],
                points: [],
                lines: []
            }
            for (var m = 0; m < relation.members().length; m++) {
                if (relation.members()[m].type == 'w') {
                    geom.ways.push(relation.members()[m].ref);
                }
                if (relation.members()[m].type == 'n') {
                    geom.nodes.push(relation.members()[m].ref);
                }
            }
            rels.push(geom);
            //console.log(rels);
        }

    });
    handler.on('done', function() {
        console.log('got relation members, reconstructing geoms');
    });

    relreader.apply(handler);

    var geomhandler = new osmium.Handler();
    var geomreader = new osmium.Reader(file, { node:true, way:true });

    if (rels.length > 0) {

        geomhandler.on('way', function(way) {
            for (r in rels) {
                for (w in rels[r].ways) {
                    if (way.id == rels[r].ways[w]) {
                        rels[r].lines.push(way.wkt());
                        //console.log(way.wkt());
                    }
                }
            }

        });
        geomhandler.on('node', function(node) {
            for (r in rels) {
                for (n in rels[r].nodes) {
                    if (node.id == rels[r].nodes[n]) {
                        rels[r].points.push(node.wkt());
                        //console.log(node.wkt());
                    }
                }
            }
        });

        geomhandler.on('done', function() {
            console.log('done!');
            // fs.unlink(file, function (err) { if (err) throw err; });
        });
    }
    geomreader.apply(geomhandler);
    //console.log(rels);
}

function convert() {
    if (
        bbox.w <= node.lon &&
        bbox.s <= node.lat &&
        bbox.e >= node.lon &&
        bbox.n >= node.lat
    ) {

        switch (argv.f)
        {
            case 'sqlite':
                //console.log('hello');
                db.run(
                    'INSERT INTO points (lon,lat,timestamp) VALUES (?,?,?)',
                    [node.lon, node.lat, node.timestamp]
                );
                break;
            case 'geojson':

                var feat = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [node.lon, node.lat]
                    },
                    properties: {
                        timestamp: node.timestamp
                    }
                }

                geojson.features.push(feat);
                fs.writeFileSync(gj, JSON.stringify(geojson,null,4));
        }

    }
}

/**/