
window.onload = function () {
    game.start();
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function loadFromFile(e) {
    var file = e.target.files[0];
    if (!file) {
        return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
        var contents = e.target.result;
        loadGame(contents);
    };
    reader.readAsText(file);
}

function saveGame() {
    var data = game.serialise();
    var filename = "save.txt";
    var type = "text";

    console.log("Saving: " + data);

    var cookieStuff = "path=/;"

    cookieStuff += "buildings=" + data;
    document.cookie = cookieStuff;

    localStorage.setItem("map", data);
    /*
        // Save to file
        var file = new Blob([data], {type: type});
    
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    */
}

function loadGame() {
    var data = localStorage.getItem("map");
    if (data) {
        console.log("Loading game from: " + data);
        game.deserialise(data);
    }
    game.refresh();
}

function clearMap() {
    localStorage.removeItem("map");
}

// Actual game stuff
var game = {
    start: function () {
        console.log("Game started");
        this.mapElem = document.getElementById("map");
        this.buildall = false;
        // game settings
        this.mapSize = 16; // max is ~28 tiles
        this.buildsPerTurn = 3; // how many buildings can be placed in one turn
        this.newHousesToBuild = 2; // # of residences that spawn/turn 
        // place tiles
        this.tileElems = [];
        this.tiles = [];
        this.attractiveness = [];
        for (y = 0; y < this.mapSize; y++) {
            var rowElems = [];
            this.tileElems.push(rowElems);
            var rowData = []; 
            this.tiles.push(rowData);
            var rowMetric = [];
            this.attractiveness.push(rowMetric);
            for (x = 0; x < this.mapSize; x++) {
                var tile = document.createElement("a");
                //tile.className = "building";
                tile.role = "button";
                tile.setAttribute("bx", x);
                tile.setAttribute("by", y);
                // events
                tile.onclick = function (e) {
                    game.onBuildingClick( Number(e.target.getAttribute("bx")), Number(e.target.getAttribute("by")));
                };
                tile.onmouseenter = function (e) {
                    game.onBuildingHovered(e.target, Number(e.target.getAttribute("bx")), Number(e.target.getAttribute("by")));
                }
                tile.onmouseleave = function (e) {
                    game.onBuildingUnhovered(e.target, Number(e.target.getAttribute("bx")), Number(e.target.getAttribute("by")));
                }
                //
                this.mapElem.appendChild(tile);
                //
                rowElems.push(tile);
                rowData.push('e');
            }
            this.mapElem.appendChild(document.createElement("br"));
        }
        // attractiveness info
        this.attrElem = document.getElementById("attractiveness");
        $('#metricPreview button').mouseleave(function(e) {
            game.displayMetric(undefined);
        }).mouseenter(function(e) {
            var mtr = e.delegateTarget.getAttribute("metric");
            game.displayMetric(mtr);
        });
        // amenities
        this.amenities = new Map();
        // init building type data
        var cheatbuildButton = document.getElementById("cheatbuild");
        this.unlimitedBuilding = false;
        cheatbuildButton.onclick = function (e) {
            game.toggleBuildall();
            game.refresh();
        }
        this.buildButtonsList = document.getElementById("buildList");
        this.buildLimits = {};
        this.buildCounts = {};
        //this.build //<span class="badge badge-dark"> 40 </span>
        for (var building in buildingDefs) {
            var buildingDef = buildingDefs[building];
            // build buttons
            //<a class="list-group-item list-group-item-action active" data-toggle="list" href="#profile" >Home</a>
            var buildButton = document.createElement("a");
            buildButton.setAttribute("data-toggle", "list");
            buildButton.setAttribute("building-type", building);
            buildButton.href = "#bla";
            buildButton.innerHTML = '<b>' + building.toUpperCase() + '</b>';
            buildButton.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
            //buildButton.style.color = buildingDef.color;
            this.buildButtonsList.appendChild(buildButton);
            buildingDef.buttonElem = buildButton;
            // build count pill
            {
                var countPill = document.createElement("span");
                countPill.className = "badge badge-dark badge-pill";
                countPill.style.backgroundColor = buildingDef.color;
                buildButton.appendChild(countPill);
                buildingDef.countElem = countPill;
            }
            // tile -> building map
            for (var idx = 0; idx < 20; idx++) {
                var tileName = buildingDef.tile + (idx == 0 ? '' : idx);
                var tileDef = tileDefs[tileName];
                if (tileDef) {
                    tileDef.building = building;
                } else {
                    break;
                }
            }
            if (idx != 0) {
                buildingDef.buildTime = idx - 1;
            }
            // build limits
            if (!buildingDef.hasOwnProperty("limit"))
                buildingDef.limit = 0;
            this.buildLimits[building] = 0;
            this.buildCounts[building] = 0;
            // amenities
            if (buildingDef.amenities) {
                for(var amty in buildingDef.amenities) {
                    if (this.amenities[amty] === undefined)
                        this.amenities[amty] = new Array( this.mapSize*this.mapSize);
                }
            } 
        }
        $('#buildList a').on('click', function (e) {
            var bla = e.delegateTarget.getAttribute("building-type");
            game.onBuildChanged(bla);
        });
        this.buildSelection = 'empty';
        //
        this.buildingNameUI = document.getElementById("buildingName");
        this.buildingInfoPanel = document.getElementById("buildingDetails");
        // resources UI & stuff
        this.resources = {
            "peeps": 0,
            "jobs": 0,
        };
        var resourceClasses = {
            "peeps": "btn-primary",
            "jobs": "btn-secondary",
        };
        this.resourcePills = {
        };
        var resourcesHolder = document.getElementById("resources");
        for (var res in this.resources) {
            //<a href="#" class="btn btn-primary"> Peeps <span class="badge badge-dark"> 40 </span> </a>
            var pill = document.createElement("span");
            this.resourcePills[res] = pill;
            pill.innerHTML = '0';
            pill.className = "badge badge-dark";
            var resBtn = document.createElement("a");
            resBtn.setAttribute("res-type", res);
            resBtn.href = "#";
            resBtn.innerHTML = res[0].toUpperCase() + res.slice(1);
            resBtn.className = "btn " + resourceClasses[res];
            resBtn.appendChild(pill);
            resourcesHolder.appendChild(resBtn);
        }
        //
        this.buildsThisTurn = 0;
        this.endTurnButton = document.getElementById("endturn");
        this.endTurnButton.onclick = function (e) {
            if (game.buildsPerTurn <= game.buildsThisTurn || game.unlimitedBuilding)
                game.endTurn();
        };
        //
        loadGame();
        //
        // move history
        this.currentState = this.tiles;
        this.historyElem = document.getElementById("history");
        this.history = [];
    },
    serialise: function () {
        return JSON.stringify(this.tiles);
    },
    deserialise: function (newData) {
        this.tiles = JSON.parse(newData);
    },
    //
    refresh: function () {
        console.log("Refreshing map");
        this.workOutResources();
        this.workOutBuildLimits();
        this.workOutMetrics();
        this.workOutAmenities();
        this.workOutHouseSpawnOrder();
        // under-construction UI
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var elem = this.tileElems[y][x];
                //elem.classList.pop
                var buildingType = this.tiles[y][x];
                var tileDef = tileDefs[buildingType];
                elem.className = tileDefs[buildingType].class
                if (tileDef.hasOwnProperty("upgrade"))
                    elem.classList.add("under-construction");
                else
                    elem.classList.remove("under-construction");
                elem.innerHTML = buildingType.toUpperCase();
            }
        }
        // build limits counts
        for (var bld in buildingDefs) {
            var countPill = buildingDefs[bld].countElem;
            var buildButton = buildingDefs[bld].buttonElem;
            if (this.buildLimits[bld] > 0) {
                countPill.innerHTML = this.buildCounts[bld] + '/' + this.buildLimits[bld];
                if (this.buildCounts[bld] < this.buildLimits[bld]) {
                    buildButton.classList.remove("disabled");
                    buildButton.classList.remove("list-group-item-secondary");
                    buildButton.classList.add("list-group-item-primary");
                } else {
                    buildButton.classList.add("disabled");
                    buildButton.classList.add("list-group-item-secondary");
                    buildButton.classList.remove("list-group-item-primary");
                }
            } else {
                countPill.innerHTML = this.buildCounts[bld];
                buildButton.classList.add("disabled");
            }
        }
        // resource counts
        for (var res in this.resources) {
            this.resourcePills[res].innerHTML = this.resources[res];
        }
        // end turn button
        if (this.buildsThisTurn >= this.buildsPerTurn || this.unlimitedBuilding) {
            this.endTurnButton.removeAttribute("disabled");
            this.endTurnButton.innerHTML = "End Turn";
        } else {
            this.endTurnButton.setAttribute("disabled", true);
            this.endTurnButton.innerHTML = "End Turn " + this.buildsThisTurn + '/' + this.buildsPerTurn;
        }
    },
    refreshAttractivenessMap:function() {
        while (this.attrElem.firstChild) {
            this.attrElem.removeChild(this.attrElem.firstChild);
        }
        var attrDocFrag = document.createDocumentFragment();
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var tile = document.createElement("a");
                var normVal = 10 + ((this.attractiveness[y][x] / 6) * 90);
                tile.style.backgroundColor = "hsl(300, " + normVal + "%, 35%)";
                tile.innerHTML = this.attractiveness[y][x];
                attrDocFrag.appendChild(tile);
            }
            attrDocFrag.appendChild( document.createElement("br"));
        }
        this.attrElem.appendChild(attrDocFrag);
    },
    refreshBuildOrderMap:function() {
        while (this.attrElem.firstChild) {
            this.attrElem.removeChild(this.attrElem.firstChild);
        }
        var houseSpawnGrid = new Array(this.mapSize*this.mapSize).fill(10000);
        for(var i = 0; i < this.houseSpawns.length;i++) {
            var info = this.houseSpawns[i];
            if (info[0] == 0)
                break;
            houseSpawnGrid[ info[1] + this.mapSize*info[2]] = i + 1;
        }
        var attrDocFrag = document.createDocumentFragment();
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var tile = document.createElement("a");
                var idx = houseSpawnGrid[x + y*this.mapSize];
                var normVal = idx == 10000 ? 10 : 20 + ( Math.max(1 - (idx / 7), 0) * 30);
                tile.style.backgroundColor = "hsl(46, 100%," + normVal + "%)";
                tile.innerHTML = normVal == 10 ? '~' : idx;
                attrDocFrag.appendChild(tile);
            }
            attrDocFrag.appendChild( document.createElement("br"));
        }
        this.attrElem.appendChild(attrDocFrag);
    },
    refreshAmenityMap:function(amty) {
        while (this.attrElem.firstChild) {
            this.attrElem.removeChild(this.attrElem.firstChild);
        }
        var attrDocFrag = document.createDocumentFragment();
        var amtyArray = this.amenities[amty];
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var tile = document.createElement("a");
                tile.style.backgroundColor = amtyArray[x + y*this.mapSize] ? "rgb(1, 238, 255)" : "rgb(34,34,34)";
                tile.innerHTML = '~';
                attrDocFrag.appendChild(tile);
            }
            attrDocFrag.appendChild( document.createElement("br"));
        }
        this.attrElem.appendChild(attrDocFrag);
    },
    // 
    toggleBuildall: function () {
        this.unlimitedBuilding = !this.unlimitedBuilding;
        console.log("Unlimited building: " + this.unlimitedBuilding);
    },
    // Game UI
    onBuildChanged: function (b) {
        if (this.unlimitedBuilding || (this.buildLimits[b] > this.buildCounts[b])) {
            console.log("Now building: " + b);
            this.buildSelection = b;
        }
    },
    onBuildingClick: function (x, y) {
        this.tryBuildBuilding(x, y);
    },
    onBuildingHovered: function (elem, x, y) {
        if (this.canBuildHere(x, y)) {
            elem.classList.add("valid");
        } else {
            elem.classList.add("invalid");
        }
        this.displayBuildingDetails(x, y);
    },
    onBuildingUnhovered: function (elem, x, y) {
        elem.classList.remove("valid");
        elem.classList.remove("invalid");
    },
    displayBuildingDetails: function (x, y) {
        var building = this.getTileBuilding(x, y);
        var titleContent = "<b>" + building.toUpperCase() + "</b>";
        if (this.isUnderConstruction(x,y))
            titleContent += "<div>Building...</div>";
        this.buildingNameUI.innerHTML = titleContent; 
        //TODO: Show turns until finished. Use <i class="material-icons">access_time</i>
        //
        var buildingDef = buildingDefs[building];
        var infoContent = buildingDef.description.slice();
        if (buildingDef.attractiveness)
            infoContent += "<br><br> <b>Attractiveness: " + buildingDef.attractiveness + " </b>";
        if (buildingDef.amenities){
            for (var amty in buildingDef.amenities){
                infoContent += "<br><br><b>" + amty.toUpperCase() + " " + buildingDef.amenities[amty] + "</b>";
            }
        }
        var happiness = this.hasLikesMet(x,y);
        if (happiness > 0){
            infoContent += "<br><br>Happy <i class=\"material-icons happy \">sentiment_very_satisfied</i>"
        }
        //
        this.buildingInfoPanel.innerHTML = infoContent;
    },
    displayMetric: function (metric) {
        //console.log("Display: " + metric);
        if (metric == "attractiveness"){
            this.refreshAttractivenessMap();
            this.mapElem.style.display = 'none';
            this.attrElem.style.display = 'block';    
        } else if (metric == "houses"){
            this.refreshBuildOrderMap();
            this.mapElem.style.display = 'none';
            this.attrElem.style.display = 'block';
        } else if (metric in this.amenities) {
            this.refreshAmenityMap(metric);
            this.mapElem.style.display = 'none';
            this.attrElem.style.display = 'block';
        } else {
            this.attrElem.style.display = 'none';
            this.mapElem.style.display = 'block';
        }
    },
    // History
    addHistoryEntry: function () {
        //<button type="button" class="btn btn-secondary">Left</button>
        var stateCopy = this.copyState();
        this.history.push(stateCopy);

        var historyButton = document.createElement("button");
        historyButton.setAttribute("history-idx", this.history.length - 1);
        historyButton.type = "button";
        historyButton.innerHTML = '<b>' + this.history.length + '</b>';
        historyButton.className = "btn btn-secondary";
        this.historyElem.appendChild(historyButton);
        historyButton.onmouseenter = function (e) {
            game.previewHistory(e.target.getAttribute("history-idx"));
        }
        historyButton.onmouseleave = function (e) {
            game.restoreCurrent();
        }
    },
    previewHistory: function (idx) {
        this.tiles = this.history[idx];
        this.refresh();
    },
    restoreCurrent: function () {
        this.tiles = this.currentState;
        this.refresh();
    },
    // Game
    copyState: function () {
        var cpy = [];
        this.tiles.forEach(element => {
            cpy.push(element.slice());
        });
        return cpy;
    },
    tryBuildBuilding: function (x, y) {
        if (this.canBuildHere(x, y)) {
            this.placeBuilding( this.buildSelection, x, y); // build selected building
            this.buildsThisTurn += 1;
            this.refresh();
        }
    },
    endTurn: function () {
        this.addHistoryEntry(); // save state
        // Upgrade tiles
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var tile = this.tiles[y][x];
                if (tileDefs[tile].hasOwnProperty("upgrade")) {
                    this.tiles[y][x] = tileDefs[tile].upgrade;
                }
            }
        }
        // spawn new residences
        this.buildNewHouses(this.newHousesToBuild);
        this.buildsThisTurn = 0;
        this.refresh();
    },
    // Tiles & Buildings
    getTileBuilding: function (x, y) {
        return tileDefs[this.tiles[y][x]].building;
    },
    isUnderConstruction: function (x, y) {
        return tileDefs[this.tiles[y][x]].hasOwnProperty("upgrade");
    },
    isTileBuilt: function (x, y) {
        var b = this.tiles[y][x];
        var buildingType = tileDefs[b].class;
        return buildingDefs[buildingType].isBuilding;
    },
    isTileBuildable: function (x, y) {
        var b = this.tiles[y][x];
        return b == 'e' ? null : b;
    },
    isTileNextToRoad: function (x,y) {
        var isIt = false;
        isIt = isIt || this.tiles[y][ Math.max(x-1, 0)] == 'r';
        isIt = isIt || this.tiles[y][ Math.min(x+1, this.mapSize - 1)] == 'r';
        isIt = isIt || this.tiles[ Math.max(y-1, 0)][x] == 'r';
        isIt = isIt || this.tiles[ Math.min(y+1, this.mapSize - 1)][x] == 'r';
        return isIt;
    },
    canBuildHere: function (x, y) {
        //return this.hasAmenity("shopping",x,y);
        //return this.isTileNextToRoad(x,y);
        if (this.unlimitedBuilding)
            return true;
        // check turn build limit
        if (this.buildsThisTurn >= this.buildsPerTurn)
            return false;
        // check build stocks
        var bld = this.buildSelection;
        if (this.buildCounts[bld] >= this.buildLimits[bld])
            return false;
        //
        if (buildingDefs[this.buildSelection].canBuild)
            return buildingDefs[this.buildSelection].canBuild(this, x, y);
        return this.isTileBuildable(x, y) == null;
    },
    placeBuilding: function (buildingType, x, y) {
        var buildingDef = buildingDefs[buildingType];
        this.tiles[y][x] = buildingDef.tile + (buildingDef.buildTime ? buildingDef.buildTime : '');
    },
    hasAmenity: function(amty, x, y){
        return this.amenities[amty][ x + y*this.mapSize] == true;
    },
    hasLikesMet: function( x,y){ // Returns percentage likes met, or -1 if building doesn't need anything to be happy
        var bld = this.getTileBuilding(x,y);
        var def = buildingDefs[bld];
        if (def.likes){
            var maxLikes = def.likes.length;
            var numLikes = 0;
            for(var i = maxLikes - 1; i >= 0; i-- ) {
                numLikes += this.hasAmenity( def.likes[i], x,y) ? 1 : 0;
            }
            return numLikes / maxLikes;
        }
        return -1;
    },
    // Misc
    buildNewHouses: function( count) {
        for ( var i = count; i > 0; i--) {
            var spawnDetails = this.houseSpawns.shift();
            if (spawnDetails[0] != 0)
                this.placeBuilding( "house", spawnDetails[1], spawnDetails[2]);
        }
    },
    workOutBuildLimits: function () {
        // limits
        for (var bld in buildingDefs) {
            this.buildLimits[bld] = buildingDefs[bld].limit;
            this.buildCounts[bld] = 0;
        }
        // counts
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var building = this.getTileBuilding(x, y);
                this.buildCounts[building] += 1;
            }
        }
        //
        buildingRules.buildLimits(this);
    },
    // Resources & Metrics
    workOutResources: function () {
        for (var res in this.resources) {
            this.resources[res] = 0;
        }
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var building = this.getTileBuilding(x, y);
                var buildingDef = buildingDefs[building];
                if (buildingDef.hasOwnProperty("resources") && 
                    !this.isUnderConstruction(x, y)) {
                    for( var resname in buildingDef.resources)
                        this.resources[resname] += buildingDef.resources[resname];
                }
            }
        }
    },
    workOutMetrics:function() {
        //
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                var building = this.getTileBuilding(x, y);
                if (buildingDefs[building].attractiveness)
                    this.attractiveness[y][x] = buildingDefs[building].attractiveness + 1;// we add 1 so the value behaves intuitively, i.e. a value of 2 has a range of 2 tiles
                else
                    this.attractiveness[y][x] = 0;
            }
        }
        // blur out
        for(var bla = 0; bla < 6; bla++)
            for (var y = 0; y < this.mapSize; y++) {
                for (var x = 0; x < this.mapSize; x++) {
                    this.attractiveness[y][x] = Math.max(this.attractiveness[y][x], this.attractiveness[y][ Math.max(x-1, 0)] - 1 );
                    this.attractiveness[y][x] = Math.max(this.attractiveness[y][x], this.attractiveness[y][ Math.min(x+1, this.mapSize - 1)] - 1 );
                    this.attractiveness[y][x] = Math.max(this.attractiveness[y][x], this.attractiveness[ Math.max(y-1, 0)][x] - 1 );
                    this.attractiveness[y][x] = Math.max(this.attractiveness[y][x], this.attractiveness[ Math.min(y+1, this.mapSize - 1)][x] - 1 );
                }
            }
    },
    spreadAmenity: function(amty, range, cx, cy){
        var amtyArray = this.amenities[amty];
        var xmax = Math.min(this.mapSize, cx + range + 1);
        var ymax = Math.min(this.mapSize, cy + range + 1);
        for (var y = Math.max(0, cy - range) ; y < ymax; y++)
            for (var x = Math.max(0, cx - range) ; x < xmax; x++)
                amtyArray[x + y*this.mapSize] = true;
    },
    workOutAmenities:function() {
        for(var amty in this.amenities)
            this.amenities[amty].fill(false);
        for (var y = 0; y < this.mapSize; y++) {
            for (var x = 0; x < this.mapSize; x++) {
                var bld = this.getTileBuilding(x,y);
                bld = buildingDefs[bld];
                if (bld.amenities && !this.isUnderConstruction(x,y)) {
                    for(var amty in bld.amenities) {
                        this.spreadAmenity(amty, bld.amenities[amty], x,y);                        
                    }
                }
            }
        }
    },
    workOutHouseSpawnOrder:function() {
        // work out spawn order
        this.houseSpawns = new Array();
        var spawnVal = 0;
        var middleCoord = this.mapSize/2;
        for (y = 0; y < this.mapSize; y++) {
            for (x = 0; x < this.mapSize; x++) {
                spawnVal = (this.attractiveness[y][x] * (middleCoord + middleCoord + 2)) - Math.abs(x - middleCoord) - Math.abs( y - middleCoord);
                if (this.tiles[y][x] != 'e' || !this.isTileNextToRoad(x,y))
                    spawnVal = 0;
                this.houseSpawns.push( [ spawnVal, x, y] );
            }
        }
        this.houseSpawns.sort( function(a,b) {
            if (a[0] < b[0])
                return 1;
            if (a[0] > b[0])
                return -1;
            if (a[1] < b[1])
                return 1;
            if (a[1] > b[1])
                return -1;
            if (a[2] < b[2])
                return 1;
            if (a[2] > b[2])
                return -1;
            return 0;
        });
    }
}
