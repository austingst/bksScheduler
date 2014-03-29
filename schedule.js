/**************************************************
COPYRIGHT 2014 AUSTIN GUEST -- ALL RIGHTS RESERVED
**************************************************/

function createMenus() {//creates event triggers for calling functions
    var menuEntries = [
      {
          name: 'Save Edits',
          functionName: 'saveEdits' 
      },{        
          name: 'Send Emails',
          functionName: 'sendEmails'
      },{        
          name: 'Update Calendar',
          functionName: 'updateCalendar'
      },{        
          name: 'Refresh View',
          functionName: 'initRefreshViewUi'
      },{
          name: 'Clone Last Week',
          functionName: 'initCloneLastWeekUi' 
      },{
          name: 'Create Records',
          functionName: 'initCreateRecordsUi' 
      },
    ];
    SpreadsheetApp.getActiveSpreadsheet().addMenu("Functions", menuEntries);
};

function initRefreshViewUi(){
  initUi('refreshView');
};

function initCloneLastWeekUi(){
  initUi('cloneLastWeek');
};

function initCreateRecordsUi(){
  initUi('createRecords');
};

function refreshView(e){

  var app = UiApp.getActiveApplication(),//open ui instance
    p = e.parameter,//store ui params
    sp = {//initialize view params from ui params
      view: {class: p.class, instance: p.instance, init: 'fromUi', gridType: p.gridType},
      model: {class: 'shifts', instance: 'index'},
      refs: [{class: 'restaurants', instance: 'info', names: p.restaurants}, {class: 'riders', instance:'info', names: p.riders}],
      dates:{start: p.start, end: p.end}
    };
  
  schedule = new View(sp);//initialize schedule view
  schedule.writeToSelf();//write from record list to view ss range
  return app.close();  //close ui
};

function cloneLastWeek(e){
  var app = UiApp.getActiveApplication(),//open ui instance
    p = e.parameter,//store ui params
    sp = {//initialize view params from ui params
      view: {class: p.class, instance: p.instance, init: 'fromLastWeek', gridType: p.gridType},
      model: {class: 'shifts', instance: 'index'},
      refs: [{class: 'restaurants', instance: 'info', names: p.restaurants}, {class: 'riders', instance:'info', names: p.riders}],
      dates:{start: p.start, end: p.end},
    },
    lwp = JSON.parse(JSON.stringify(sp));
  
  lwp.dates = {
    start: p.start.incrementDate(-7),
    end: p.end.incrementDate(-7),
    weekMap: p.start.incrementDate(-7).getWeekMap()
  };
  lwp.view.init = 'fromUi';

  lwSchedule = new View(lwp);
  sp.lw = lwSchedule;

  schedule = new View(sp);
  schedule.writeToSelf();
  return app.close();
};

function createRecords(e){
  var app = UiApp.getActiveApplication(),//open ui instance
    p = e.parameter,//store ui params
    sp = {//initialize view params from ui params
      view: {class: p.class, instance: p.instance, init: 'fromRange', gridType: p.gridType},
      model: {class: 'shifts', instance: 'index'},
      refs: [{class: 'restaurants', instance: 'info', names: p.restaurants}, {class: 'riders', instance:'info', names: p.riders}],
      dates:{start: p.start, end: p.end},
      newRecs: true
    };

  schedule = new View(sp);
  if (!schedule.hasErrors()){
    schedule.writeToModel().refreshViews(['grid']);
  }
  return app.close();
};

function saveEdits(){

  var schedule = new View({
      view: {class: 'schedule', instance: getWsName(), init: 'fromRange'},
      model: {class: 'shifts', instance: 'index'},
      refs: [{class: 'restaurants', instance: 'info'}, {class: 'riders', instance:'info'}]
    });
  
  if (!schedule.hasErrors()){
    
    var availability = new View({
      view: {class: 'availability', instance: 'weekly', init: 'fromRel'},
      model: {class: 'availabilities', instance: 'index'},
      refs: [{class: 'riders', instance: 'info'}, {class: 'restaurants', instance: 'info'}],//maybe not necess?
      dates: {start: schedule.dates.start, end: schedule.dates.end},
      rel: {view: schedule, join: 'shiftid', vols: ['status', 'riderid']}
    });

    if(!availability.hasErrors()){
      
      schedule.rel = {view: availability, join: 'availabilityid', vols: ['status', 'restaurantid', 'start', 'end']};
    
      schedule
        .getConflictsWith(availability)
        .showConflicts();
      
      if (!schedule.hasConflicts()){
        schedule
          .writeToRel()
          .writeToModel()
          .refreshViews(['grid', 'weekly', 'update']);  
        availability
          .refreshViews(['grid', 'weekly']); 
      }
    }  
  }          
};

function sendEmails(){
  var schedule = new View({
      view: {class: 'schedule', instance: getWsName(), init: 'fromRange'},
      model: {class: 'shifts', instance: 'index'},
      refs: [{class: 'restaurants', instance: 'info'}, {class: 'riders', instance:'info'}]
    });

  if (!schedule.hasErrors()){
  
    var availability = new View({
      view: {class: 'availability', instance: 'weekly', init: 'fromRel'},
      model: {class: 'availabilities', instance: 'index'},
      refs: [{class: 'riders', instance: 'info'}, {class: 'restaurants', instance: 'info'}],//maybe not necess?
      dates: {start: schedule.dates.start, end: schedule.dates.end},
      rel: {view: schedule, join: 'shiftid', vols: ['status', 'riderid']}
    });

    schedule.rel = {view: availability, join: 'availabilityid', vols: ['status', 'restaurantid', 'start', 'end']};
    
    schedule
      .getConflictsWith(availability)
      .showConflicts();
    
    if (!schedule.hasConflicts()){    
      schedule
        .sendEmails()
        .writeToRel()
        .writeToModel()
        .refreshViews(['grid', 'weekly', 'update']);  
      availability
        .refreshViews(['grid', 'lookup']); 
    }
  }
};

function updateCalendar(){
    var schedule = new View({
      view: {class: 'schedule', instance: getWsName(), init: 'fromRange'},
      model: {class: 'shifts', instance: 'index'},
      refs: [{class: 'restaurants', instance: 'info'}, {class: 'riders', instance:'info'}]
      // vols: {grid: ['riderid', 'status'], list: ['riderid', 'status']},
    });

  schedule
    .writeToCalendar()
    .setVols(['eventid'])
    .writeToModel();

};

