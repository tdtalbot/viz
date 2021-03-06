"use strict"

var Stomp = require('stompjs');

var httpPort = 8082;

console.log(__dirname);

var express = require('express'),
    http = require('http');
var app = express();
var server = http.createServer(app);
var fs = require('fs');
let timeseriesData = null;

server.listen(httpPort);

app.use(express.static(__dirname));
app.engine('html', require('ejs').renderFile);
app.set('views', __dirname);


var outputCallback = function(message){
    //$("#debug").append("Output "+message.body + "\n");
	console.log('received message '+message.body);
	if (timeseriesData == null) {
		timeseriesData = [];
	}
	
	let messageObj = JSON.parse(message.body)
	if(messageObj.command=='nextTimeStep'){
		console.log('command timestep');
		console.log(messageObj.output)
		timeseriesData = messageObj.output;
	}
		
}
var gossHost = '172.20.128.20';

//Create client

var stompClient;
var stompStatus = false;

var stompSuccessCallback = function (frame) {
    stompStatus = true;
    console.log('STOMP: Connection successful');
	
	stompClient.subscribe("/topic/goss/gridappsd/fncs/output", outputCallback);
	console.log(stompClient.subscriptions);

};
var stompFailureCallback = function (error) {
    console.log('STOMP: ' + error);
    setTimeout(stompConnect, 10000);
    console.log('STOMP: Reconecting in 10 seconds');
};

function stompConnect() {
    console.log('STOMP: Attempting connection');
    // recreate the stompClient to use a new WebSocket
    stompClient = Stomp.overWS("ws://"+gossHost+':61614');
	console.log(stompClient);
	stompClient.heartbeat.incoming=0;
    stompClient.heartbeat.outgoing=0;
    stompClient.connect("system", "manager", stompSuccessCallback, stompFailureCallback);
	
	console.log('connected '+stompClient.connected);
	
	//stompClient.subscribe("/topic/goss/gridappsd/fncs/output", outputCallback);
}
stompConnect();

//var client = Stomp.client( "ws://"+gossHost+":61614");
//client.heartbeat.incoming=0;
//client.heartbeat.outgoing=0;

//client.subscribe("/topic/goss/gridappsd/fncs/output", outputCallback);





app.get(['/', '/ieee8500'], function(req, res) {
    res.render('index.html');
});

/** Input: 
 *  ieee8500_base.json
    {feeder: [
        {swing_nodes: [
            {name:, phases:, nominal_voltage:}
        ]},
        {capacitors: [
            {name:, parent:, phases:, kvar_A:, kvar_B:, kvar_C}
        ]},
        {overhead_lines: [
            {name:, from:, to:, phases:, length:, configuration:}
        ]},
        {transformers: [
            {name:, from:, to:, phases:, configuration:}
        ]},
        {regulators: [
            {name:, from:, to:, phases:, configuration:}
        ]}
    ]}

    ieee8500_xy.json
    {coordinates: [
        {node:, x:, y:}
    ]}
    
    Output:
    {elements: [
        // May want to change this depending on use. 
        // Right now, going with format used by D3 layout algorithms:
        // https://bl.ocks.org/mbostock/4062045
        {name:, type:, data:} 
    ], 
    links: [
        {name:, from:, to:, data:}
    ]}
*/
app.get('/data/ieee8500', (req, res) => {

    let topologyJson = getIeee8500Topology();

    res.json(topologyJson);

}); 

function getIeee8500Topology() {

    function getOrCreateElement(name, type, hashByName, elementsList) {

        let existingElement = hashByName[name];
        if (!existingElement) {
            existingElement = {name: name, type: type, data: {}, children: []};
            hashByName[name] = existingElement;
            elementsList.push(existingElement);
        }
        return existingElement;
    }

    let baseContents = fs.readFileSync('./data/ieee8500/ieee8500_base.json', 'utf-8');
    let baseJson = JSON.parse(baseContents);

    let coordinateContents = fs.readFileSync('./data/ieee8500/ieee8500_xy.json', 'utf-8');
    let coordinateJson = JSON.parse(coordinateContents);

    let knownElementsByName = {};
    let elements = [];
    let links = [];

    let regulatorParents = {
        reg_VREG3: 'nd_l2692633',
        reg_VREG4: 'nd_m1089120',
        reg_VREG2: 'nd_l2841632',
        reg_FEEDER_REG: 'nd_m1209814'
    };

    // Create top-level elements
    [
        {index: 0, type: 'swing_nodes'},
        {index: 3, type: 'transformers'}
    ].forEach((group) => {
        console.log(group);
        console.log(baseJson.feeder[group.index]);
        baseJson.feeder[group.index][group.type].forEach((element) => {
                elements.push({
                    name: element.name, 
                    type: group.type, 
                    data: element,
                    children: []});
            })
    })
    
    // Create the lines, creating nodes as needed along the way
    baseJson.feeder[2].overhead_lines.forEach((overheadLine) => {

        let fromNode = getOrCreateElement(overheadLine.from, 'node', knownElementsByName, elements);
        let toNode = getOrCreateElement(overheadLine.to, 'node', knownElementsByName, elements);

        links.push({
            name: overheadLine.name,
            from: fromNode,
            to: toNode,
            data: overheadLine
        })
    })

    // Add the capacitors under the nodes
    baseJson.feeder[1].capacitors.forEach((element) => {
        let parent = knownElementsByName[element.parent];
        parent.children.push({
            name: element.name,
            type: 'capacitors',
            data: element,
            children: []
        })
    })

    // Add the regulators under the nodes 
    console.log(baseJson.feeder[4]);
    baseJson.feeder[4].regulators.forEach((element) => {
        let parent = knownElementsByName[regulatorParents[element.name]];
        parent.children.push({
            name: element.name,
            type: 'regulators',
            data: element,
            children: []
        })
    })

    let numMissingNodes = 0;
    let numFoundNodes = 0;
    coordinateJson.coordinates.forEach((coordinate) => {

        let node = knownElementsByName[coordinate.node];
        if (node == undefined) {
            console.log('missing node ' + coordinate.node + ' for which coordinates exist.');
            numMissingNodes++;
            return;
        } else {
            numFoundNodes++;
        }
        node.x = coordinate.x;
        node.y = coordinate.y;
    })
    console.log(numMissingNodes + ' nodes missing, ' + numFoundNodes + ' found');

    let topologyJson = {
        elements: elements,
        links: links
    };

    return topologyJson;
}


let timeseriesIndex = 0;

function getTimeseriesData(filename) {

    const contents = fs.readFileSync(filename, 'utf-8');
    const lines = contents.trim().split('\n');
    let headers = [];
    let data = [];
    lines.forEach((line) => {
        if (line.indexOf('# timestamp') == 0) {
            headers = line.replace('# ', '').trim().split(',');
        } else if (line.indexOf('#') != 0) {
            const tokens = line.trim().split(',');
            let datum = { };
            for (var i = 0; i < tokens.length; i++) {
                datum[headers[i]] = tokens[i];
            }
            data.push(datum);
        }
    });
    return data;
}

function getAllTimeseriesData() {

    const dataFileNames = ['cap_0',
        'cap_1',
        'cap_2',
        'cap_3',
        'EOL_1_1_V',
        'EOL_1_2_V',
        'EOL_2_1_V',
        'EOL_2_2_V',
        'EOL_3_1_V',
        'EOL_4_1_V',
        'feeder_power',
        'feeder_reg_taps',
        'reg_taps_2',
        'reg_taps_3',
        'reg_taps_4'];

    let allData = {};
    dataFileNames.forEach((filename) => {
        let fileData = getTimeseriesData('./data/ieee8500/timeseries/' + filename + '.csv');
        allData[filename] = fileData;
    });

    let timeseriesData = [];
    let cap0Data = allData['cap_0'];
    for (var i = 0; i < cap0Data.length; i++) {
        let datum = {};
        datum.timestamp = cap0Data[i].timestamp;
        dataFileNames.forEach((filename) => {
            datum[filename] = allData[filename][i];
        })
        timeseriesData.push(datum);
    }

    return timeseriesData;
}

function getAllTimeseriesDataNewFormat() {

    return JSON.parse(fs.readFileSync('./data/ieee8500/timeseries/goss_output.json'));
}

function getTimeseriesToTopologyMapping() {
    
    return {
        cap_0: 'cap_capbank0',
        cap_1: 'cap_capbank1',
        cap_2: 'cap_capbank2',
        cap_3: 'cap_capbank3',
        EOL_1_1_V: 'reg_FEEDER_REG',
        EOL_1_2_V: 'reg_FEEDER_REG',
        EOL_2_1_V: 'reg_VREG2',
        EOL_2_2_V: 'reg_VREG2',
        EOL_3_1_V: 'reg_VREG3',
        EOL_4_1_V: 'reg_VREG4',
        feeder_power: 'reg_FEEDER_REG',
        feeder_reg_taps: 'reg_FEEDER_REG',
        reg_taps_2: 'reg_VREG2',
        reg_taps_3: 'reg_VREG3',
        reg_taps_4: 'reg_VREG4'
    }
}

function getTimeseriesToTopologyMappingNewFormat() {

    return {
        cap_capbank0a: 'cap_capbank0',
        cap_capbank0b: 'cap_capbank0',
        cap_capbank0c: 'cap_capbank0',
        cap_capbank1a: 'cap_capbank1',
        cap_capbank1b: 'cap_capbank1',
        cap_capbank1c: 'cap_capbank1',
        cap_capbank2a: 'cap_capbank2',
        cap_capbank2b: 'cap_capbank2',
        cap_capbank2c: 'cap_capbank2',
        cap_capbank3: 'cap_capbank3', // Can we make this the same as the others?
        'nd_190-7361' : 'nd_190-7361',
        'nd_190-8581' : 'nd_190-8581',
        'nd_190-8593' : 'nd_190-8593',
        'nd__hvmv_sub_lsb' : 'reg_FEEDER_REG',
        'nd_l2673313' : 'nd_l2673313',
        'nd_l2876814' : 'nd_l2876814',
        'nd_l2955047' : 'nd_l2955047',
        'nd_l3160107' : 'nd_l3160107',
        'nd_l3254238' : 'nd_l3254238',
        'nd_m1047574' : 'nd_m1047574',
        reg_FEEDER_REG : 'reg_FEEDER_REG',
        reg_VREG2 : 'reg_VREG2',
        reg_VREG3 : 'reg_VREG3',
        reg_VREG4 : 'reg_VREG4',
        xf_hvmv_sub : 'reg_FEEDER_REG'        
    }
}

function getTimeseriesToPlotSeriesMappingNewFormat() {

    return {

        voltage_A: [
            'nd_190-7361',
            'nd_190-8581',
            'nd_190-8593',
            'nd__hvmv_sub_lsb',
            'nd_l2673313',
            'nd_l2876814',
            'nd_l2955047',
            'nd_l3160107',
            'nd_l3254238',
            'nd_m1047574',
        ],

        voltage_B: [
            'nd_190-7361',
            'nd_190-8581',
            'nd_190-8593',
            'nd__hvmv_sub_lsb',
            'nd_l2673313',
            'nd_l2876814',
            'nd_l2955047',
            'nd_l3160107',
            'nd_l3254238',
            'nd_m1047574',
        ],

        voltage_C: [
            'nd_190-7361',
            'nd_190-8581',
            'nd_190-8593',
            'nd__hvmv_sub_lsb',
            'nd_l2673313',
            'nd_l2876814',
            'nd_l2955047',
            'nd_l3160107',
            'nd_l3254238',
            'nd_m1047574',
        ],

        power_in_A: [
            'xf_hvmv_sub'
        ],

        power_in_B: [
            'xf_hvmv_sub'
        ],

        power_in_C: [
            'xf_hvmv_sub'
        ],

        tap_A: [
            'reg_FEEDER_REG',
            'reg_VREG2',
            'reg_VREG3',
            'reg_VREG4'
        ],

        tap_B: [
            'reg_FEEDER_REG',
            'reg_VREG2',
            'reg_VREG3',
            'reg_VREG4'
        ],

        tap_C: [
            'reg_FEEDER_REG',
            'reg_VREG2',
            'reg_VREG3',
            'reg_VREG4'
        ]
    }
}

function getTimeseriesToPlotSeriesMapping() {
    
    return {

        voltage_A: [
            'EOL_1_1_V',
            'EOL_1_2_V',
            'EOL_2_1_V',
            'EOL_2_2_V',
            'EOL_3_1_V',
            'EOL_4_1_V'
        ],

        voltage_B: [
            'EOL_1_1_V',
            'EOL_1_2_V',
            'EOL_2_1_V',
            'EOL_2_2_V',
            'EOL_3_1_V',
            'EOL_4_1_V'
        ],

        voltage_C: [
            'EOL_1_1_V',
            'EOL_1_2_V',
            'EOL_2_1_V',
            'EOL_2_2_V',
            'EOL_3_1_V',
            'EOL_4_1_V'
        ],

        power_in: [
            'feeder_power'
        ],

        tap_A: [
            'feeder_reg_taps',
            'reg_taps_2',
            'reg_taps_3',
            'reg_taps_4'
        ],

        tap_B: [
            'feeder_reg_taps',
            'reg_taps_2',
            'reg_taps_3',
            'reg_taps_4'
        ],

        tap_C: [
            'feeder_reg_taps',
            'reg_taps_2',
            'reg_taps_3',
            'reg_taps_4'
        ]
    }
}

app.get('/data/ieee8500/timeseries', (req, res) => {
	let json = {};
    if (timeseriesData != null) {
		//json = 
    //    timeseriesData = getAllTimeseriesDataNewFormat();
    //} else {

    //if (timeseriesIndex >= timeseriesData.length) {
    //    timeseriesIndex = 0;
    //} 

      json = {
        timeseriesToTopologyMapping: getTimeseriesToTopologyMappingNewFormat(),
        timeseriesToPlotSeriesMapping: getTimeseriesToPlotSeriesMappingNewFormat(),
        data: timeseriesData
		};
	}
    res.json(json);
});

console.log('Server running at: localhost ' + httpPort);