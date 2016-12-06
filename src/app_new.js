var query = "", 
    parameters = {}, 
    tabNumber = 0;

function dateTimePick() {
  $('.datetimepicker1').datetimepicker({
    sideBySide:true
  });
  $('.datetimepicker2').datetimepicker({
    sideBySide:true,
  });
}
function toggleEndDate() {
  var input = $(".datetimepicker2");
// désactivé tant que le filtre par date de fin n'est pas opérationnel sur le xml
//  input.css('visibility', input.css('visibility') == 'hidden' ? 'visible' : 'hidden');
}
function closeForm() {
  $(".active > .js-task-choice").hide();
}
function openForm() {
  $(".active > .js-task-choice").show();
}

function init() {
  query = window.location.search ; 
  tabNumber = $('.tab-content .tab-pane.active').attr('id').slice(3);

  if (query !== "") {
    parameters = {};
    query.substr(1).split("&").forEach(function(item) {
      var s = item.split("=");
      var key = s[0];
      var value = s[1] && decodeURIComponent(s[1]);
      (key in parameters) ? parameters[key].push(value) : parameters[key] = [value];
    })
// if task1 et start1: ci-dessous, else if task2 et start2 etc.
    d3.json("http://tasks.hotosm.org/project/"+parameters['task'+tabNumber]+".json", function(task) { 
      if (!task) {
        alert ("This task does not exist or you do not have permission to access it.");
      } else if (task.geometry) {
        createDashboard(task,parameters["start"+tabNumber]);
      } else {
        alert("This task has no geometry attribute.");
      } 
    });
  }
}

function loadDashboard() {
  var taskID = document.querySelector(".active .js-tasknumber").value;
  var startDateValue = document.querySelector(".active .js-startdate").value;
// tests
//  var taskID = 2;
//  var startDateValue = "10/28/2016 9:44 AM";

  var startDateText = moment(startDateValue, "MM/DD/YYYY hh:mm a").toISOString();
  var endDateInput = $(".js-enddate");
  var endDateValue = endDateInput.css('visibility') == 'hidden' ? moment().format() : endDateInput.val();

  if (taskID && startDateValue) {
    tabNumber = $('.tab-content .tab-pane.active').attr('id').slice(3);  
    var task = "task"+tabNumber;
    var start = "start"+tabNumber;
    if (query === "") {
      history.pushState(null, null, "?"+task+"="+taskID+"&"+start+"="+startDateText);
    } else {
      parameters[task] = taskID;
      parameters[start] = startDateText;

      query = "?";
      for (var key in parameters) {
        query += key + "=" + parameters[key] + "&";
      }
      history.pushState(null, null, query.slice(0, -1));
    }
    d3.json("http://tasks.hotosm.org/project/"+taskID+".json", function(task) { 
      if (!task) {
        alert ("This task does not exist or you do not have permission to access it.");
      } else if (task.geometry) {
        createDashboard(task,startDateText);
      } else {
        alert("This task has no geometry attribute.");
      } 
    });

  } else {
    alert("Veuillez remplir tous les champs.");
  }
}

function createDashboard(task,startDate, endDate=null) {
    console.log("Creating the dasboard for task "+task.id+" and start date: "+startDate);

    $(".tab-pane.active > .js-task-choice").hide();
    $(".tab-pane.active .js-dashboard").empty();

    var tab = document.querySelector(".tab-pane.active");
    var taskTemplate = document.querySelector('#task-template');
    var dashboard = document.importNode(taskTemplate.content, true);
    tab.appendChild(dashboard);
    
    var longName = "Task # "+task.id+" | "+task.properties.name;
    var tabName = longName.length <= 30 ? longName : longName.substring(5,30)+" …";
    
    document.querySelector(".tab-pane.active .js-task_title").dataset.tabname = tabName;
    $(".nav-tabs > li.active > a").text(tabName);
    $(".tab-pane.active .js-task_title").html("<h3>"+ longName +"</h3>");
    $(".tab-pane.active .js-task_date").html("<p><b>Since :</b> "+moment(startDate.toString()).format("llll")+"</p>");
    $("#km_highways").attr('id', 'km_highways_'+tabNumber);
    $("#area_landuse").attr('id', 'area_landuse_'+tabNumber);
    
//carte principale
    var map = L.map($(".tab-pane.active .js-map")[0]).setView([0,0 ], 4);

    var OpenMapSurfer_Grayscale = L.tileLayer('http://korona.geog.uni-heidelberg.de/tiles/roadsg/x={x}&y={y}&z={z}', {
	attribution: 'Map tiles by <a href="" target="_blank">korona.geog.uni-heidelberg.de</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, ODbL',
	maxZoom: 19,
	}).addTo(map);

//carte length
var map_length = L.map($('.tab-pane.active .js-map_length')[0], { zoomControl:false, attributionControl: true }).setView([0,0 ], 4);
map_length.locate({setView: true, maxZoom: 16});
    var bm_length  = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}', {
	attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0" target="_blank">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, ODbL',
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
    
//    loading();
    
    //count buildings
    var buildings_count = [];
    $.get("http://overpass.osm.rambler.ru/cgi/xapi?way[building=*][bbox="+bbox+"][@newer="+startDate+"][@meta]", function(buildings) {
    
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
        
        
    nb_buildings.innerHTML = buildings_count.length;
//    loading();
    
    });    
        

    var highways_count = [];
    //count highway
    $.get("http://overpass.osm.rambler.ru/cgi/xapi?way[highway=*][bbox="+bbox+"][@newer="+startDate+"][@meta]", function(highways) {
        
        var hw_geojson = osmtogeojson(highways);
        var length = 0;
        
        for (var i in hw_geojson.features)
        {
          var item = hw_geojson.features[i];
        
      	  if (item.geometry.type =="LineString") {
            highways_count.push(item)
          } else {}
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
          item.date = new Date(item.properties.meta.timestamp);
          var length_obj = turf.lineDistance(highways_count[i], 'kilometers');
          length = length+length_obj
          highways_count[i].properties.length = length_obj;
        }
        
        length = Math.round(length * 10) / 10;

        // awful but need to understand first element before improving
        if (tabNumber == 1) {km_highways_1.innerHTML = length+" km of roads<br>"+ highways_count.length +" roads created";} // TODO bon décompte ?
        else if (tabNumber == 2) {km_highways_2.innerHTML = length+" km of roads<br>"+ highways_count.length +" roads created";}
        else if (tabNumber == 3) {km_highways_3.innerHTML = length+" km of roads<br>"+ highways_count.length +" roads created";}
        else {km_highways_4.innerHTML = length+" km of roads<br>"+ highways_count.length +" roades created";}
    
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
    var chart = dc.pieChart(".tab-pane.active .js-graph_highways");
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
	
//	loading();
	
	
	////////////////////////// landuse
	
    var landuse_count = [];
    //count highway
    $.get("http://overpass.osm.rambler.ru/cgi/xapi?way[landuse=*][bbox="+bbox+"][@newer="+startDate+"][@meta]", function(landuse) {
        
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
//    loading();
    
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
    
    // awful but needs further comprehension to be improved
    if (tabNumber == 1) {area_landuse_1.innerHTML = area+" km² of landuse<br>" ;}//+ landuse_count.length +  "<i> landuse count?<i>" ;}
    else if (tabNumber == 2) {area_landuse_2.innerHTML = area;}
    else if (tabNumber == 3) {area_landuse_3.innerHTML = area;}
    else {area_landuse_4.innerHTML = area;}        
//    area_landuse.innerHTML = "<h1>"+area+"</h1>";
    
    // graph landuse
    var ndx2;
    var chart2 = dc.pieChart(".tab-pane.active .js-graph_area");
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
  var tab1 = document.querySelector("#tab1");
  // on récupère le template et on le clone
  var formTemplate = document.querySelector('#form-template');
  var form1 = document.importNode(formTemplate.content, true);
  // on le charge dans le HTML
  tab1.appendChild(form1);

  // idem avec une autre div à remplir avec le même template
  var tab2 = document.querySelector("#tab2");
  var form2 = document.importNode(formTemplate.content, true);
  tab2.appendChild(form2);
    
  var tab3 = document.querySelector("#tab3");
  var form3 = document.importNode(formTemplate.content, true);
  tab3.appendChild(form3);

  var tab4 = document.querySelector("#tab4");
  var form4 = document.importNode(formTemplate.content, true);
  tab4.appendChild(form4);
  
  $('.nav-tabs > li > a[data-toggle="tab"]').on('hidden.bs.tab', function (e) {
    // onglet fermé/hidden: $(e.target)
    // onglet ouvert/shown: $(e.relatedTarget)
    tabNumber = $('.tab-content .tab-pane.active').attr('id').slice(3);
    var shortenedTitle = $(e.target).text().match(/#.*\|/);
    if (shortenedTitle) {
      $(e.target).text(shortenedTitle.toString().slice(0,-2));
    }
    var newTitle = $(".tab-pane.active .js-task_title").data('tabname')
    if (newTitle != "") {
      $(e.relatedTarget).text(newTitle);
    }
  });

} else {
  alert("Problème de compatibilité avec votre navigateur.\nIl est temps de le mettre à jour et/ou d'abandonner InternetExplorer.");
  // TODO Use old templating techniques or libraries.
}

//var loading_value = 0;
//function loading() {
//  loading_value = loading_value+1;
//  console.log(loading_value);
//  document.getElementById('loading_bar').style.width= loading_value*25  +'%';
//  if (loading_value==4){
//    console.log("loaded");
//    $("#loading").hide();
//    $("#foo").hide();
//  } else {}
//}
