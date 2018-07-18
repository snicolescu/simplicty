var buildingDefs = {
    'house': {
        tile: 'h',
        color: "rgb(209, 166, 25)",
        description:"Holds peeps",
        isBuilding: true,
        resources: { 'peeps': 10 },
    },
    'store': {
        tile: 's',
        color: "rgb(1, 238, 255)",
        description:"Gives peeps something to do",
        isBuilding: true,
        resources: { 'jobs': 5 },
        limit:1,
    },
    'townhall': {
        tile: 'th',
        color: "rgb(255, 136, 1)",
        description:"Center of power",
        isBuilding: true,
        attractiveness:5,
        limit:1,
    },
    'park': {
        tile: 'p',
        color: "rgb(65, 95, 38)",
        description:"Beatifies area",
        isBuilding: true,
        attractiveness:3,
        limit:5,
    },
    'road': {
        tile: 'r',
        color: "rgb(96, 96, 96)",
        description:"Vroom",
        isBuilding: true,
        limit:5,
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
        //TEMP
        game.buildLimits['house'] += game.buildCounts['house'];
        //
        game.buildLimits['park'] += Math.floor( game.buildCounts['house'] / 5 );
        game.buildLimits['road'] += Math.floor( game.buildCounts['house']);
        //
        game.buildLimits['store'] += Math.floor(game.resources['peeps'] / 15);
    },
};