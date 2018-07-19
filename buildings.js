var buildingDefs = {
    'road': {
        tile: 'r',
        color: "rgb(96, 96, 96)",
        description:"Vroom",
        isBuilding: true,
        limit:5,
    },
    'park': {
        tile: 'p',
        color: "rgb(65, 95, 38)",
        description:"Beautifies area",
        isBuilding: true,
        attractiveness:2,
        limit:5,
    },
    'store': {
        tile: 's',
        color: "rgb(1, 238, 255)",
        description:"Gives peeps something to do",
        isBuilding: true,
        resources: { 'jobs': 5 },
        amenities: { 'shopping': 3 },
        limit:1,
    },
    'townhall': {
        tile: 'th',
        color: "rgb(255, 136, 1)",
        description:"Center of power",
        isBuilding: true,
        attractiveness:4,
        limit:1,
    },
    'reserve': {
        tile: 'x',
        color: "rgb(141, 140, 140)",
        description:"Save this tile for later building",
        limit:3,
    },
    'house': {
        tile: 'h',
        color: "rgb(209, 166, 25)",
        description:"Holds peeps",
        isBuilding: true,
        resources: { 'peeps': 10 },
    },
    'water': {
        tile: 'w',
        color: "rgb(49, 153, 194)",
        description:"Glug",
        isBuilding: false,
        canBuild: function (game, x, y) {
            return true;
        },
    },
    'empty': {
        tile: 'e',
        color: "rgb(200, 200, 200)",
        description:"Full of potential",
        isBuilding: false,
        canBuild: function (game, x, y) {
            return game.isTileBuilt(x, y);
        },
    },
};

var buildingRules = {
    buildLimits: function( game ) {
        //
        game.buildLimits['park'] += Math.floor( game.buildCounts['house'] / 8 );
        game.buildLimits['road'] += Math.floor( game.buildCounts['house']);
        //
        game.buildLimits['store'] += Math.floor(game.resources['peeps'] / 15);
    },
};