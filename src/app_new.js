function choosetask(){

}	

function createDashboard(task,start_date) {
    
    console.log("Creating the dasboard for task "+task.id+" and start date: "+start_date);

    $("#task_title").innerHTML = "<h2>Task #"+task.id+" | "+task.properties.name+"</h2>";
    $("#task_date").innerHTML = "<p><b>Since :</b> "+start_date+"</p>";
//carte principale
    var map = L.map("map").setView([0,0 ], 4);

    var OpenMapSurfer_Grayscale = L.tileLayer('http://korona.geog.uni-heidelberg.de/tiles/roadsg/x={x}&y={y}&z={z}', {
	maxZoom: 19,
	}).addTo(map);

//carte length
var map_length = L.map('map_length', { zoomControl:false, attributionControl: false }).setView([0,0 ], 4);
map_length.locate({setView: true, maxZoom: 16});
    var bm_length  = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}', {
	attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyrigh">OpenStreetMap</a>',
	subdomains: 'abcd',
	minZoom: 0,
	maxZoom: 20,
	ext: 'png'
}).addTo(map_length);

    var style_aoi = {
    	"color": "#f9ec12",
    	"weight": 5,
    	"fillOpacity": 0,
    	"opacity": 1
    };

    var task_polygon = L.geoJson(task,{style: style_aoi}).addTo(map);
    
    map.fitBounds(task_polygon.getBounds());
    var polygon_bounds = task_polygon.getBounds();

    var bbox = ""+polygon_bounds._southWest.lng+","+polygon_bounds._southWest.lat+","+polygon_bounds._northEast.lng+","+polygon_bounds._northEast.lat+"";
    var date_text = start_date.toISOString();
    
    loading();
    
    //count buildings
    var buildings_count = [];
    $.get("http://www.overpass-api.de/api/xapi?way[building=*][bbox="+bbox+"][@newer="+date_text+"][@meta]", function(buildings) {
    
        var building_geojson = osmtogeojson(buildings);
        for (var i in building_geojson.features)
        {
        var item = building_geojson.features[i];
        
        
        
        	if (item.geometry.type =="Polygon") {
            buildings_count.push(item)
            }
            else{}
        }
        
    var style_building = {
            "color": "#58c4f2",
            "weight": 4,
            "fillOpacity": 1,
            "opacity": 1,
        	};
    
        var buildings_layer = L.geoJson(buildings_count,{style: style_building})
        .addTo(map);
        
        buildings_layer.bringToFront();
        
        
    nb_buildings.innerHTML = "<h1>"+buildings_count.length+"</h1>";
    loading();
    
    });    
        

    var highways_count = [];
    //count highway
    $.get("http://www.overpass-api.de/api/xapi?way[highway=*][bbox="+bbox+"][@newer="+date_text+"][@meta]", function(highways) {
        
        var hw_geojson = osmtogeojson(highways);
        var length = 0;
        
        for (var i in hw_geojson.features)
        {
        var item = hw_geojson.features[i];
        
        	if (item.geometry.type =="LineString") {
            highways_count.push(item)
            }
            else{}
        }
        
        var style_highways = {
            "color": "#f0782c",
            "weight": 2,
            "fillOpacity": 1,
            "opacity": 1,
        	};
        	
        var highways_layer = L.geoJson(highways_count,{style: style_highways})
        .addTo(map);
        
        for (var i in highways_count)
        {
        var item = highways_count[i];
        
        item.date = new Date(item.properties.meta.timestamp)
        
        var length_obj = turf.lineDistance(highways_count[i], 'kilometers');
        length = length+length_obj
            
        highways_count[i].properties.length = length_obj;
        }
        
        length = Math.round(length * 10) / 10;
        
    km_highways.innerHTML = "<h1>"+length+"</h1>";
    
    // draw line corresponding of length
    var pt1 = turf.point([5.9215,45.58789]);
    var pt1_layer = L.geoJson(pt1).addTo(map_length);
    
    var distance = length;
    var distance2 = length/3;
    var bearing = 90;
    var units = 'kilometers';

    var pt2 = turf.destination(pt1, distance, bearing, units);
    var pt2_layer = L.geoJson(pt2).addTo(map_length);
    
    var line = turf.linestring([
            pt1.geometry.coordinates,
            pt2.geometry.coordinates
        	]);
    
    var line_layer = L.geoJson(line).addTo(map_length);
    map_length.fitBounds(line_layer.getBounds());
    
    var pt_label_options = {
    	radius: 0,
    	opacity: 0,
    	fillOpacity: 0
    };
    
    var pt_label = turf.destination(pt1, distance2, bearing, units);
    
    var pt_label_layer = L.geoJson(pt_label, {
        	pointToLayer: function (feature, latlng) {
        	return L.circleMarker(latlng, pt_label_options).bindLabel(distance+" km", { noHide: true, offset:[0,-15] });
        	}
        }).addTo(map_length);
    
    //////////////// pie chart highways per type
    
    var ndx;
    var chart = dc.pieChart("#graph_highways");
    ndx = crossfilter(highways_count);
    var hw_graph_dim = ndx.dimension(function(d){return d.properties.tags.highway});
    var hw_graph_group = hw_graph_dim.group().reduceSum(function(d) {return d.properties.length});
    
	chart
    .width(200)
    .height(200)
    .slicesCap(4)
    .innerRadius(40)
	.ordinalColors(['#e6251f', '#9fc659','#f9ec11','#58c4f2', '#f0772b' ])
    .dimension(hw_graph_dim)
    .group(hw_graph_group) // by default, pie charts will use group.key as the label
    .renderLabel(true)
	.render();
	
	loading();
	
	
	////////////////////////// landuse
	
    var landuse_count = [];
    //count highway
    $.get("http://www.overpass-api.de/api/xapi?way[landuse=*][bbox="+bbox+"][@newer="+date_text+"][@meta]", function(landuse) {
        
        var landuse_geojson = osmtogeojson(landuse);
        var area = 0;
        for (var i in landuse_geojson.features)
        {
        var item = landuse_geojson.features[i];
        
        	if (item.geometry.type =="Polygon") {
            landuse_count.push(item)
            }
            else{}
        
        }
    loading();
    
    var style_landuse = {
            "color": "#9ec658",
            "weight": 2,
            "fillOpacity": 1,
            "opacity": 1,
        	};
    
        var landuse_layer = L.geoJson(landuse_count,{style: style_landuse})
        .addTo(map);
    
        landuse_layer.bringToBack();
    
    for (var i in landuse_count)
    {
    var area_obj = turf.area(landuse_count[i]);
        area = area+area_obj;
    landuse_count[i].properties.size = area_obj/1000000;
    }
    
    area = area/1000000;
    area = Math.round(area * 100) / 100;
    
    area_landuse.innerHTML = "<h1>"+area+"</h1>";
    
    // graph landuse
    var ndx2;
    var chart2 = dc.pieChart("#graph_area");
    ndx2 = crossfilter(landuse_count);
    var lu_graph_dim = ndx2.dimension(function(h){return h.properties.tags.landuse});
    var lu_graph_group = lu_graph_dim.group().reduceSum(function(h) {return h.properties.size});
    
	chart2
    .width(200)
    .height(200)
    .slicesCap(4)
    .innerRadius(40)
	.ordinalColors(['#e6251f', '#9fc659','#f9ec11','#58c4f2', '#f0772b' ])
    .dimension(lu_graph_dim)
    .group(lu_graph_group) // by default, pie charts will use group.key as the label
    .renderLabel(true)
	.render();
    
    });
    
	});

/////progress bar
document.getElementById('validated_bar').style.width= task.properties.validated  +'%';
document.getElementById('done_bar').style.width= task.properties.done +'%';

}    


function supportsTemplate() {
  return 'content' in document.createElement('template');
}

if (supportsTemplate()) {
  // on récupère la div qu'on veut remplir
  var tab1 = document.querySelector("#task1");
  // on récupère le template et on le clone
  var formtemplate = document.querySelector('#form-template');
  var form1 = document.importNode(formtemplate.content, true);
  // on le charge dans le HTML
  tab1.appendChild(form1);

  // idem avec une autre div à remplir avec le même template
  var tab2 = document.querySelector("#task2");
  var form2 = document.importNode(formtemplate.content, true);
  tab2.appendChild(form2);
    
//  var tasktemplate = document.querySelector('#task-template');
//  var td = tasktemplate.content.querySelectorAll("p");
//  td[0].textContent = "1235";
//  td[1].textContent = "Stuff";

//  var dashboard1 = document.importNode(tasktemplate.content, true);
//  tab1.appendChild(dashboard1);
  
//  td[0].textContent = "0384";
//  td[1].textContent = "Stuff2";

//  var clone2 = document.importNode(tasktemplate.content, true);
//  tab2.appendChild(clone2);

  $(".close-form").click(function(){
    $(".active #task-choice").hide();
  });
  $("#open-form").click(function(){
    $(".active #task-choice").show();
  });
  $("#go").click(function(){
    var task_id = document.getElementById('task_number').value;
    var startdate_value = document.getElementById('startdate').value;
    if (task_id && startdate) {
      start_date = new Date(startdate_value);

      d3.json("http://tasks.hotosm.org/project/"+task_id+".json", function(task) {    	
        	if (task.geometry) {
            createDashboard(task,start_date);
        	} else {
        	alert("This task ID doesn't exist.");
        	} 
        });
    } else {
      alert("Veuillez remplir tous les champs.");
    }
  });


} else {
  alert("Problème de compatibilité avec votre navigateur.\nIl est temps de le mettre à jour et/ou d'abandonner InternetExplorer...");
  // TODO Use old templating techniques or libraries.
}


