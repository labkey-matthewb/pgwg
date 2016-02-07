
/** GOOGLE MAPS */

var google_map;
function init_map()
{
    var myOptions =
    {
        zoom: 12,
        center: new google.maps.LatLng(47.641906,-122.3284127),
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    google_map = new google.maps.Map(document.getElementById('gmap_canvas'), myOptions);

    var marker = new google.maps.Marker({map: google_map, position: new google.maps.LatLng(47.641906,-122.3284127)});
    marker.infowindow = new google.maps.InfoWindow({content: '<strong>Pacific Groundwater Group</strong>'});
    google.maps.event.addListener(marker, 'click', function ()
    {
        marker.infowindow.open(google_map, marker);
    });
}
function create_map_markers(store, onclick)
{
    store.each(function(record)
    {
        var name = record.data.LocalName;
        var latitude = record.data.Latitude;
        var longitude = record.data.Longitude;
        var marker = new google.maps.Marker({map: google_map, position: new google.maps.LatLng(latitude,longitude)});
        marker.infowindow = new google.maps.InfoWindow({content: '<strong>' + name + '</strong>'});
        google.maps.event.addListener(marker, 'click', function ()
        {
            marker.infowindow.open(google_map, marker);
            onclick(record);
        });
    });
}
function center_map(record)
{
    var latitude = record.data.Latitude;
    var longitude = record.data.Longitude;
    google_map.panTo({lat:latitude,lng:longitude});
}


/** APPLICATION **/

// globals for easier debugging
var $ = $ || jQuery;
var sitesStore=null, bmpStore=null, communicationStore=null, issueStore=null;
var selectedSiteRecord = null;


function createStoreForList(list, callback)
{
    var store;
    store = Ext4.create('LABKEY.ext4.data.Store',
    {
        schemaName: 'lists',
        queryName: list,
        autoLoad: true,
        listeners:{'load' : callback}
    });
    return store;
}


function start_application(target)
{
    var _loaded=[];
    function checkForAllStoresLoaded(store)
    {
        _loaded.push(store);
        if (_loaded.length==4)
            render_application(target);
    }
    sitesStore = createStoreForList('Sites',checkForAllStoresLoaded);
    bmpStore = createStoreForList('BMP',checkForAllStoresLoaded);
    communicationStore = createStoreForList('Communication',checkForAllStoresLoaded);
    issueStore = createStoreForList('Issue',checkForAllStoresLoaded);
}


function render_application(target)
{
    // UI COMPONENTS //
    var toolbarItems =
        [
            {
                xtype    : 'textfield',
                name     : 'site_search',
                emptyText: 'enter search term',
                listeners:{change:function(field)
                {
                    sitesStore.removeFilter('search');
                    if (field.value)
                    {
                        var regexp = new RegExp(field.value, "i");
                        var filterFn = function(r)
                        {
                            return regexp.test(r.data.LocalName) || regexp.test(r.data.PropertyOwner) || regexp.test(r.data.ParcelNumber) || regexp.test(r.data.FarmType)
                        };
                        sitesStore.filter({id: 'search', filterFn:filterFn});
                    }
                }}
            },
            {
                text: 'Show All', handler:function(){sitesStore.clearFilter();}
            },
            {
                text: 'Show Active', handler:function(){sitesStore.filter('Active',true);}
            },
            '-', '->', '-'
        ];
    if (LABKEY.user.canInsert)
    {
        toolbarItems.push(
            {
                text: 'Create New Site', handler:function(){window.location="./query-insertQueryRow.view?schemaName=lists&query.queryName=Sites&returnUrl="+encodeURI(window.location);}
            });
    }
    var toolbar = Ext4.create('Ext.toolbar.Toolbar',
        {
            items: toolbarItems
        });
    var siteDetail = Ext4.create('LABKEY.ext.DetailsPanel',
        {
            showTitle : false,
            titlePrefix : 'Site',
            store : sitesStore
        });
    var mapPanel = Ext4.create('Ext.Panel',
        {
            html: "<div style='overflow:hidden;height:100%;width:100%;'><div id='gmap_canvas' style='height:100%;width:100%;'></div></div>"
        });
    var sitesList = Ext4.create('Ext.view.View',
        {
            store: sitesStore,
            tpl: new Ext4.XTemplate(
                    '<tpl for=".">',
                    '<div class="site-wrap" style="padding:3pt;">',
                    '<div style="float:left;"><b>{LocalName}</b></div><div style="float:right">{FarmType}</div>' +
                    '<div style="clear:both;float:left;">{PropertyOwner}</div><div style="float:right">{ParcelNumber}</div>' +
                    '<div style="clear:both;"></div>',
                    '</div>',
                    '</tpl>'
            ),
            itemSelector: 'div.site-wrap',
            emptyText: 'No sites available'
        });
    var bmpGrid = Ext4.create('LABKEY.ext4.GridPanel',
        {
            store: bmpStore,
            title: 'BMP',
            emptyText: 'No reports available'
        });
    var commGrid = Ext4.create('LABKEY.ext4.GridPanel',
        {
            store: communicationStore,
            title: 'Communications',
            emptyText: 'No communications available'
        });
    var issueGrid = Ext4.create('LABKEY.ext4.GridPanel',
        {
            store: issueStore,
            title: 'Issues',
            emptyText: 'No issues available'
        });


    // EVENTS //

    function update_site_selection(view, selected)
    {
        if (selected.length==1)
        {
            selectedSiteRecord = selected[0];
            siteDetail.bindRecord(selectedSiteRecord);
            [communicationStore, bmpStore, issueStore].forEach(function (s)
            {
                s.clearFilter();
                s.filter("SiteId", selectedSiteRecord.data.SiteId);
            });
            center_map(selectedSiteRecord);
            sitesList.getSelectionModel().select([selectedSiteRecord],false,true);
            var parameters = LABKEY.ActionURL.getParameters(window.location.toString());
            delete parameters.siteid;
            delete parameters.SiteId;
            parameters.SiteId = selectedSiteRecord.data.SiteId;
            window.history.replaceState( {} , selectedSiteRecord.data.LocalName, "?"+LABKEY.ActionURL.queryString(parameters) );
        }
    }
    sitesList.on("selectionchange", update_site_selection);


    // LAYOUT AND RENDER

    var tabPanel = Ext4.create('Ext.tab.Panel',
    {
        activeTab:0,
        items: [bmpGrid, commGrid, issueGrid]
    });
    var sitePanel = Ext4.create('Ext.Panel',
    {
        layout : 'hbox',
        items:[siteDetail,mapPanel]
    });


    // layout specific properties and initial sizing
    // TODO mplement resize() method
    var appWidth = 1000;
    var appHeight = 800;

    toolbar.dock = 'top';           // top of outer border panel

    sitesList.region = 'west';      // west of outer border panel
    sitesList.split = true;
    sitesList.width = 200;

    siteDetail.border = false;
    siteDetail.width=appWidth-200-400;

    mapPanel.height = 400;
    mapPanel.minHeight = 300;
    mapPanel.width = mapPanel.minWidth = 400;

    tabPanel.region = 'south';      // south of inner border panel
    tabPanel.split = true;
    tabPanel.height = 400;
    tabPanel.minHeight = 300;

    var outer = Ext4.create('Ext.Panel',{
        renderTo:target,
        layout:'border',
        width: appWidth, height:appHeight,
        minWidth:800, minHeight:600,
        resizable:true,
        resizeHandles:'se',
        dockedItems:[toolbar],
        items :
        [
            sitesList,
            {
                xtype:'panel', region:'center', layout:'border',
                items:
                [
                    {xtype:'panel', region:'center', layout:'hbox', height:400, minHeight:400, items:[siteDetail,mapPanel]},
                    tabPanel
                ]
            }
        ]
    });

    // MAPS //

    init_map();
    create_map_markers(sitesStore, function(record){update_site_selection(null,[record])});

    // INITIAL STATE //

    var siteId = LABKEY.ActionURL.getParameter('SiteId') || LABKEY.ActionURL.getParameter('siteid');
    var startRecord = null;
    if (siteId)
    {
        sitesStore.each(function(record)
        {
            if (record.data.SiteId == siteId)
                startRecord = record;
        });
    }
    if (!startRecord || startRecord.data.Active)
        sitesStore.filter('Active',true);
    if (!startRecord && sitesStore.getCount() > 0)
        startRecord = sitesStore.getAt(0);
    if (startRecord)
        update_site_selection(null, [startRecord]);


    // RESIZE HANDLING

    function Window_onResize()
    {
        w = $(window).width();
        h = $(window).height();
        x = outer.getX();
        y = outer.getY();
        outer.setWidth(Math.max(800,w-x-40));
        outer.setHeight(Math.max(600,h-y-40));
    }

    $(window).resize(Window_onResize);
    Window_onResize();
}


