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

for (var day = start; day <= end; day++) {
    var xml = day + '.xml';
    var gj = day + '.geojson';

    convert(xml, gj);
    /*
    step(
        function () {
            getdata(xml, this);
        },
        function (err, xml, gj) {
            if (err) throw err;
            convert(xml, gj);
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

function convert (xml, gj) {
    var geojson = { "type": "FeatureCollection", "features": [] }
    //console.log('hi', xml);
    // osmium things
    var file = new osmium.File(xml)
    var reader = new osmium.Reader(file);
    var handler = new osmium.Handler();

    handler.on('node',function(node) {

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
    });
    handler.on('done', function() {
        console.log('done!');
        // fs.unlink(file, function (err) { if (err) throw err; });
    });

    reader.apply(handler);
}

/**/