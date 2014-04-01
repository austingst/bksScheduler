/**************************************************
COPYRIGHT 2014 AUSTIN GUEST -- ALL RIGHTS RESERVED
**************************************************/

//*** VIEW CONSTRUCTOR FUNCTION ***//

function View(p){
  
  Logger.log('initializing new view!')
  
  //*ATTRIBUTES*//

  var self = this;//store reference to view's context
  
  if (p.view.init == 'fromUi' || p.view.init == 'fromLastWeek'){cacheParams(p);}//cache params, store them as attribute
  this.p = p;
  this.errors = {};
  this.newRecs = p.newRecs;

  this.cache = {
    params: {class: p.view.class+'Params', instance: p.view.instance, sheet: new Sheet(p.view.class+'Params', p.view.instance)},
    rowmap: {class: p.view.class+'GridMaps', instance: 'rowmap', sheet: new Sheet(p.view.class+'GridMaps', 'rowmap')},
    cellmap: {class: p.view.class+'GridMaps', instance: 'cellmap', sheet: new Sheet(p.view.class+'GridMaps', 'cellmap')}
  };

  this.view = p.view;
  this.view.type = this.view.instance == 'grid' ? 'grid' : 'list';
  this.view.sheet = new Sheet(this.view.class,  this.view.instance);
  
  if(this.view.type == 'grid' && (this.view.init == 'fromRange' || this.view.init == 'fromAltInstance')){
    this.view.gridType = this.cache.params.sheet.data[0].gridtype;
  }

  //LOG VIEW PARAMS (for testing) 
  // for (var j in this.view){Logger.log('this.view['+j+']: ' + this.view[j]);}

  this.model = p.model;
  this.model.sheet = new Sheet(this.model.class,  this.model.instance);

  if (this.view.init =='fromRel'){this.rel = p.rel;}
  if (this.view.init == 'fromLastWeek'){this.lw = p.lw;}

  initDates();
  for (var d in this.dates){
    Logger.log('this.dates['+d+']: ' + this.dates[d]);
  }
  initRefs(); 

  if (this.view.type == 'grid'){refreshRowMap(getRMFromRange);}    

  if (this.view.init == 'fromRange'){
    initVols();
  } else if (this.view.init == 'fromUi' || this.view.init == 'fromAltInstance' || this.view.init == 'fromRel'){
    initFilters();
  }
  initRecordList();//array of objects: each object is a record to be displayed in the view

  //**METHODS*//

  this.writeToSelf = function (){
    Logger.log('starting .writeToSelf()');
    if(this.view.type === 'grid'){initGridMap();}//map of which record attributes correspond to which cell of a grid view
    initRange();//2d array mapping record list values to spreadsheet range in view instance
    var range = [];
    if (this.range === undefined || this.range === ''){
      range[0] = ['Nothing found!'];
      toast('There were no records found matching those parameters!');
    } else {
      range = this.range;
    }
    // Logger.log('range: ' + range);
    this.view.sheet.clearRange();
    this.view.sheet.setRange(range);
    this.view.sheet = new Sheet(this.view.class, this.view.instance);
    if (this.view.type == 'grid' && this.gridMap !== undefined) {
      refreshRowMap(getRMFromGridMap);
      refreshCellMap();
      // highlightDoubleBookings();
      appendGridMetaData();
    }
    return this;
  };

  // function highlightDoubleBookings(){
  //   for (var i = 1; i < 14; i++) {
  //     for (var j = 0; j < self.view.sheet.data.length; j++) {
  //       for (var k = j+1; k < self.view.sheet.data.length; k++) {
  //         if (self.view.sheet.data[j][self.view.sheet.headers[i]] == self.view.sheet.data[k][self.view.sheet.headers[i]]){
  //           self.view.sheet.g.getRange(j + self.view.sheet.row.first, i + self.view.sheet.col.first).setBackground('#ff9900');
  //           self.view.sheet.g.getRange(k + self.view.sheet.row.first, i + self.view.sheet.col.first).setBackground('#ff9900');
  //         }
  //       }
  //     }
  //   }
  // }

  function appendGridMetaData(){
    appendDate(self.view.sheet);
    if (self.view.class == 'schedule'){appendColSums(self.view.sheet);}

    function appendDate(sheet){
      var range = sheet.g.getRange(sheet.row.getLast() + 2, 1),
        dateStr = self.dates.weekMap.mon.getFormattedDate() + ' - ' + self.dates.weekMap.sun.getFormattedDate();
      range.setValue('Week: ' + dateStr);
      range.setBackground('#d8d8d8');
    };

    function appendColSums(sheet){
      var range = sheet.g.getRange(sheet.row.first, 16, self.view.sheet.data.length + 2, 5),
        arr = [];
      for (var i = 0; i < self.view.sheet.data.length; i++) {
        var row = i + self.view.sheet.row.first;
        if (self.view.class == 'schedule'){
          arr.push(['=counta(b'+row+':o'+row+')', 'countif(b'+row+':o'+row+',"*,*")', '=if(p'+row+'>10, 10, s'+row+')', '=p'+row+'+q'+row, '=5*q'+row+'+10*r'+row]);        
        } else if (self.view.class == 'availability'){

        }
      };
      arr.push(['','','','','']);
      arr.push(['=sum(p2:p'+(self.view.sheet.data.length+1)+')', '=sum(q2:q'+(self.view.sheet.data.length+1)+')', '=sum(r2:r'+(self.view.sheet.data.length+1)+')', '=sum(s2:s'+(self.view.sheet.data.length+1)+')', '=sum(t2:t'+(self.view.sheet.data.length+1)+')']);
      range.setFormulas(arr);
    };

  };

  this.writeToModel = function(){
    Logger.log('Running '+ this.view.class +'.writeToModel()!')
    if (self.newRec && self.view.type !== 'grid'){
      Logger.log('Tried to create new recs from list view. Aborted.');
      Toast('Sorry! You can only run "Create New Records" from grid view!');
      return;
    } else {
      for (var i = 0; i < this.recordList.length; i++){//match record list rows to this.model.sheet rows by id
        var id = this.recordList[i].id;
        // Logger.log('this.recordList['+i+'].id: ' + this.recordList[i].id);
        if (id === undefined || id === ''){//if the view's id attr indicates a new record, create one 
          // Logger.log('writing new record to model.');
          this.writeNewRecordToModel(this.recordList[i], i);
        } else {//otherwise, overwrite all cells in this.model.sheet whose values don't match those in the record list
          for (var j = 0; j< this.vols.length; j++){
            var vol = this.vols[j];
            if (noMatch(this.recordList[i][vol], this.model.sheet.data[id][vol])){
              // Logger.log('writing record:');
              // Logger.log('id: ' + id);
              // Logger.log('vol: ' + vol);
              // Logger.log('row: ' + this.model.sheet.getRowNum(id));
              // Logger.log('col: ' + this.model.sheet.getColNum(vol));
              // Logger.log('VALUE - this.recordList['+i+']['+vol+']: ' + this.recordList[i][vol]);
              this.model.sheet.updateCell(this.model.sheet.getRowNum(id), this.model.sheet.getColNum(vol), this.recordList[i][vol]);
            }
          }        
        }
      }
      Logger.log('refreshing sheet');
      this.model.sheet = new Sheet(this.model.class, this.model.instance);//refresh view object's copy of model to reflect changes just written to it
      toast('Updated '+ this.model.class +' model!');
      Logger.log('Finished running '+ this.view.class +'.writeToModel()!')
      return this;      
    }
  };

  function noMatch(vol1, vol2){
    if (self.view.type == 'grid' && self.view.gridType == 'time'){
      return vol1.getTime() !== vol2.getTime() ? true : false;
    } else {
      return vol1 !== vol2 ? true : false;
    }
  }

  this.writeNewRecordToModel = function(record, i){
    Logger.log('running .writeNewRecordToModel()');
    // for (var j in record){
    //   Logger.log ('record['+j+']: ' + record[j]);
    // }
    var range = [];
    record.id = this.model.sheet.g.getLastRow() - this.model.sheet.row.first + 1;//set the new record's id to one greater than the last id in the model
    this.recordList[i].id = record.id;//append new id to record list
    for (var j = 0; j < this.model.sheet.headers.length; j++){
      var val = record[this.model.sheet.headers[j]];
      if (val === undefined){//substitute empty string for undefined values
        range.push('');
      } else {
        range.push(val);        
      }
    }
    // Logger.log('range: ' + range);
    this.model.sheet.g.appendRow(range);
    return this;
  };

  this.refreshViews = function(instances){
    Logger.log('Running .refreshViews()!');
    // Logger.log('this.p: ' + this.p);
    // for (var j in this.p){
    //   Logger.log('this.p['+j+']: ' + this.p[j]);
    // }
    for (var i = 0; i < instances.length; i++) {
      var p = this.p,//retrieve core paramaters for view class from this view instance's paramaters 
        p2 = getParamsFromAltInstance(this.view.class, instances[i]);//retrieve paramaters for view instance to be refreshed
      if (!self.newRecs){//modify core params according to values stored for alt instance
        p.refs[0].names = p2.ref0Names;
        p.refs[1].names = p2.ref1Names;
        p.dates = {start: p2.start, end: p2.end};        
      }
      p.view.init = 'fromAltInstance';//add params specifying initialization from view (and view instance)
      p.view.instance = instances[i];
      var altView = new View(p);//construct view object for other view instance
      altView.writeToSelf();//call .writeToSelf() to refresh the view instance
    }
    toast('Updated ' + this.view.class + ' views!');
    Logger.log('Finished running .refreshViews()!');
    return this;
  };

  this.writeToRel = function(){
    Logger.log('Running ' + this.view.class + '.writeToRel()');
    var viewJoin = this.rel.join,
      relJoin = this.rel.view.rel.join;
    for (var i = 0; i < this.recordList.length; i++) {//loop through recordlist
      if (this.recordList[i][viewJoin] !== undefined && this.recordList[i][viewJoin] !== ''){//proceed only for records joined to rel records
        var viewid = this.recordList[i].id; 
          relid = this.recordList[i][viewJoin],
          relRec = this.rel.view.getRecordFromId(relid);
        for (var j = 0; j < this.rel.vols.length; j++) {//overwrite rel values with volatile view values
          var vol = this.rel.vols[j];
          Logger.log('this.recordList['+i+']['+vol+']: ' + this.recordList[i][vol]);
          Logger.log('relRec['+vol+']: ' + relRec[vol]);
          if (this.recordList[i][vol] !== relRec[vol]){//match records on join id & overwrite rel records that don't match view records
            if (this.view.class == 'schedule' && this.recordList[i][vol] == 'unassigned'){
              var val = 'available';
            } else if (this.view.class == 'availability' && (this.recordList[i][vol] == 'available' || this.recordList[i][vol] == 'not available')){
              var val = 'unassigned';
            } else if (this.recordList[i][vol] === undefined || this.recordList[i][vol] === ''){
              var val = '';
            } else {
              var val = this.recordList[i][vol];
            }
            this.rel.view.model.sheet.updateCell(this.rel.view.model.sheet.getRowNum(relid), this.rel.view.model.sheet.getColNum(vol), val);
          }
        } 
        if (this.recordList[i][this.refs[1].idKey] === undefined || this.recordList[i][this.refs[1].idKey] === ''){ //delete joins if ref1 vals are null (ie if references to the entity joining the records has been deleted)
          // Logger.log('deleting join for record '+ this.recordList[i].id);
          relRec[relJoin] = '';//delete join from rel RL
          this.rel.view.model.sheet.updateCell(this.rel.view.model.sheet.getRowNum(relid), this.rel.view.model.sheet.getColNum(relJoin), '');//delete join from rel model
          relRec[this.refs[0].idKey] = '';//delete joined ref1id from rel RL
          // Logger.log('relid row: ' + this.rel.view.model.sheet.getRowNum(relid));
          // Logger.log('rel ref1 row: ' + this.rel.view.model.sheet.getColNum(this.refs[0].idKey));
          this.rel.view.model.sheet.updateCell(this.rel.view.model.sheet.getRowNum(relid), this.rel.view.model.sheet.getColNum(this.refs[0].idKey), '');//delete joined ref1id from rel RL
          this.recordList[i][viewJoin] = '';//delete join from view RL
          this.model.sheet.updateCell(this.model.sheet.getRowNum(viewid), this.model.sheet.getColNum(viewJoin), '');//delete join from view model (unnecessary if writing to model immediately afterwards)
        }
      }
    }
    this.rel.view.model.sheet = new Sheet(this.rel.view.view.sheet.class, this.rel.view.view.sheet.instance);//refresh rel object's copy of model to reflect edits
    toast('Updated ' + this.rel.view.model.class + 'model!');
    Logger.log('Finished running ' + this.view.class + '.writeToRel()');
    return this;
  };  

  this.getConflictsWith = function(View){
    Logger.log('running .getConflictsWith()');
    toast('Checking for conflicts...')
    var viewRl = this.recordsSortedByRef[1];
    var relRl = View.recordsSortedByRef[0];
    getConflicts(viewRl, relRl);
    Logger.log('finished running .getConflictsWith()');    
    return this;
  };

  function getConflicts(viewRl, relRl){   
    Logger.log('running getConflicts()');
    self.conflicts = [];
    self.doubleBookings = [];
    self.noConflicts = [];
    for (var refId in viewRl) {//loop through joined refs (riders)
      for (var i = 0; i < viewRl[refId].length; i++) {//loop through view records associated with each ref
        // if (isDoubleBooked(viewRl[refId][i], viewRl[refId])){self.doubleBookings.push(viewRl[refId][i].id);}
        for (var j = 0; j < relRl[refId].length; j++){//loop through rel records associated with ref
          if (matchOnDayAndPeriod(viewRl[refId][i], relRl[refId][j])) {//match on day and period
            Logger.log('rel join id: ' + relRl[refId][self.rel.view.rel.join]);
            Logger.log ('view join id:' + viewRl[refId].id);
            if (//match on records with status either not available or joined to a different record
              relRl[refId][j].status == 'not available' ||
              (
                (relRl[refId][j][self.rel.view.rel.join] !== undefined && relRl[refId][j][self.rel.view.rel.join] !== '' && viewRl[refId][i][self.rel.join] !== undefined && viewRl[refId][i][self.rel.join] !== '')&&
                (relRl[refId][j][self.rel.view.rel.join] !== viewRl[refId][i].id)// || relRl[refId][j].id !== viewRl[refId][i][self.rel.join]
              )
            ){//add records matching above (status & join) criteria to conflicts array, not matching to noConflicts
              self.conflicts.push({viewid: viewRl[refId][i].id, relid: relRl[refId][j].id});
            } else {
              self.noConflicts.push({viewid: viewRl[refId][i].id, relid: relRl[refId][j].id});
            }
          }
        }
      }
    }

    function matchOnDayAndPeriod(rec1, rec2){
      if (rec1.start.getDate() == rec2.start.getDate() && (rec1.am == rec2.am || rec1.pm == rec2.pm)){
        return true;
      } else {
        return false;
      }
    };

    // function isDoubleBooked(rec, recs){
    //   for (var i = 0; i < recs.length; i++) {
    //     if(matchOnDayAndPeriod(rec, recs[i])) {
    //       Logger.log('double booked!')
    //       return true;
    //     }
    //   }
    //   return false;
    // };

    // //LOG CONFLICTS (for testing)
    // for (var i = 0; i < self.conflicts.length; i++) {
    //   for (var j in self.conflicts[i])
    //     Logger.log('self.conflicts['+i+']['+j+']: ' + self.conflicts[i][j]);
    // }
    // //LOG NOCONFLICTS (for testing)
    // for (var i = 0; i < self.noConflicts.length; i++) {
    //   for (var j in self.noConflicts[i])
    //     Logger.log('self.noConflicts['+i+']['+j+']: ' + self.noConflicts[i][j]);
    // }
    // //LOG DOUBLE BOOKINGS (for testing)
    // for (var i = 0; i < self.doubleBookings.length; i++) {
    //   Logger.log('self.doubleBookings[i]: ' + self.doubleBookings[i]);
    // };

    Logger.log('finished running getConflicts()');
  };

  this.showConflicts = function(){
    Logger.log('running .showConflicts()');
    if (this.conflicts.length > 0){
      toast('Conflicts found! Highlighted rows conflict with ' + this.refs[1].class + ' ' + this.rel.view.view.class);
      handleConflicts();
    } else {
      toast('No conflicts found!');
    }
    // handleDoubleBookings();      
    handleNoConflicts();
    Logger.log('finished running .showConflicts()');
  };

  function handleConflicts(){
    Logger.log('running handleConflicts()');
    // Logger.log('self.recordList.length: ' + self.recordList.length);
    for (var i = 0; i < self.conflicts.length; i++) {
      // Logger.log('self.conflicts.length: ' +self.conflicts.length);
      // Logger.log('self.conflicts['+i+'].viewid: ' + self.conflicts[i].viewid);
      self.getRecordFromId(self.conflicts[i].viewid).status = 'not available';//set status in record list     
      if (self.view.type == 'list'){//reflect status in list row
        var statusCell = self.view.sheet.g.getRange(getRowFromRecordId(self.conflicts[i].viewid), self.view.sheet.headers.indexOf('status') + 1),//get range coordinates for cell showing record's status attr
          recordRow = self.view.sheet.g.getRange(getRowFromRecordId(self.conflicts[i].viewid), self.view.sheet.col.first, 1, self.view.sheet.col.getLast());//get range coordinates for row containing record
        statusCell.setValue('not available');//set value of cell containing status attribute to 'not available'
        recordRow.setBackground('#FF00FF');//set background of row containing record to hot pink
      } else if (self.view.type == 'grid'){//reflect status in grid cell
        var gc = getGridRowColFromRecordId(self.conflicts[i].viewid),//get row/col coordinates for gric cell containing record
          recordCell = self.view.sheet.g.getRange(gc.row, gc.col),//use r/c coordinates to identify cell's range location
          newVal = recordCell.getValue().slice(0,-2).concat('-n');//set value of code in range to '-' (corresponds to 'not available') 
        recordCell.setValue(newVal);
      }
    }    
  };

  function handleNoConflicts(){
    Logger.log('running handleNoConflicts()');
    Logger.log('self.noConflicts.length: ' + self.noConflicts.length);
    for (var i = 0; i < self.noConflicts.length; i++) {
      if (self.view.type == 'list'){//unhighlight noConflict rows that are still pink (because they used to contain a conflict)
        Logger.log('self.noConflicts['+i+'].viewid: ' + self.noConflicts[i].viewid);
        var recordRow = self.view.sheet.g.getRange(getRowFromRecordId(self.noConflicts[i].viewid), self.view.sheet.col.first, 1, self.view.sheet.col.getLast());
         // Logger.log('recordRow.getValues(): ' + recordRow.getValues());
         // Logger.log ('recordRow.getBackground(): ' + recordRow.getBackground());
         if(recordRow.getBackground()== '#FF00FF'){
          recordRow.setBackground('#FFFFFF');
        }
      }//vv write joins
      self.getRecordFromId(self.noConflicts[i].viewid)[self.rel.join] = self.noConflicts[i].relid;//set the record's join id to the id of the corresponding record in the view's rel
      var viewJoinRange = self.model.sheet.g.getRange(self.model.sheet.getRowNum([self.noConflicts[i].viewid]), self.model.sheet.getColNum(self.rel.join));//only update join id in model if it is different from current join id val
      if (viewJoinRange.getValue()!== self.noConflicts[i].relid){viewJoinRange.setValue(self.noConflicts[i].relid);}
      // //LOG JOIN VALUES (for testing) 
      // Logger.log('self.getRecordFromId('+self.noConflicts[i].viewid+')['+self.rel.join+']: ' + self.getRecordFromId(self.noConflicts[i].viewid)[self.rel.join]);

      self.rel.view.getRecordFromId(self.noConflicts[i].relid)[self.rel.view.rel.join] = self.noConflicts[i].viewid;//set the join id of the corresponding record in the view's rel to the id of this record
      var relJoinRange = self.rel.view.model.sheet.g.getRange(self.rel.view.model.sheet.getRowNum([self.noConflicts[i].relid]), self.rel.view.model.sheet.getColNum(self.rel.view.rel.join));//only update join id in model if it is different from current join id val
      if (relJoinRange.getValue()!== self.noConflicts[i].viewid){relJoinRange.setValue(self.noConflicts[i].viewid);}      
      // // LOG JOIN VALUES (for testing)
      // Logger.log('self.rel.view.getRecordFromId('+self.noConflicts[i].relid+')['+self.rel.view.rel.join+']: ' + self.rel.view.getRecordFromId(self.noConflicts[i].relid)[self.rel.view.rel.join]);

    };
    Logger.log('finished running unhighlightNoConflicts()');
  };

  //**ACCESSOR METHODS **//

  this.setVols = function (vols){
    this.vols = vols;
    return this;
  };

  this.concatVols = function (vols){
    this.vols.concat(vols);
    return this;
  };

  this.hasErrors = function(){
    for (var i in this.errors){if (this.errors[i] !== undefined){return true;}}return false;
  };

  this.hasConflicts = function (){
    return this.conflicts.length > 0 ? true : false;
  };

  function initRecordAccessors(){

    self.getRecordsSortedByRef = function (ref){
      Logger.log('running getRecordsSortedByRef('+ref.class+')');
      var records = {};
      // for (var j in ref){
      //   Logger.log('ref['+j+']: ' + ref[j]);
      // }
      // Logger.log('ref.ids: ' + ref.ids);
      for (var i = 0; i < ref.ids.length; i++) {
        records[ref.ids[i]]=[];
        for (var j = 0; j < self.recordList.length; j++){
          if (self.recordList[j][ref.idKey] === ref.ids[i] ){//&& self.recordList[j][ref.idKey] !== undefined
            records[ref.ids[i]].push(self.recordList[j]);
          }        
        }
      }
      Logger.log('finished running getRecordsSortedByRef('+ref.class+')');
      // //LOG SORTED RECORDS (for testing)
      // for (var refId in records){
      //   for (var j=0; j<records[refId].length; j++){
      //     for (var k in records[refId][j]){
      //       Logger.log('records['+refId+']['+j+']['+k+']: ' + records[refId][j][k]);             
      //     }
      //   }
      // }
      return records;
    };

    self.getRecordFromId = function(id){
      for (var i = 0; i < self.recordList.length; i++) {if (self.recordList[i].id == id) {return self.recordList[i];}}
    };

  };

  function isRef(attr){
    var isRef = false;
    for (var i = 0; i < self.refs.length; i++){
      if (attr.indexOf(self.refs[i].nameKey) >= 0){
        isRef = true;
      }
    }
    return isRef;
  };

  function getRefIndexFromClass(class){
    for (var i = 0; i < self.refs.length; i++) {if (self.refs[i].class == class){return i;}};
  };

  function getRefIdFromName(index, name){
    return self.refs[index].ids.length == 1 ? self.refs[index].ids[0] : self.refs[index].ids[self.refs[index].names.indexOf(name)];
  };

  function getRefNameFromId (index, id){
     return self.refs[index].names.length == 1 ? self.refs[index].names[0] : self.refs[index].names[self.refs[index].ids.indexOf(id)];
  };

  function initRefAccessors(){
    Logger.log('running initRefAccessors!')

    self.getNonGreedyRefs = function(){
      var ngRefs = [];
      for (var i = 0; i < self.refs.length; i++){
        if (!self.refs[i].greedy){
          ngRefs.push(self.refs[i]);
        }
      }
      return ngRefs;
    };
    
    self.getGreedyRefs = function(){
      var gRefs = [];
      for (var i = 0; i < self.refs.length; i++){
        if (self.refs[i].greedy){
          gRefs.push(self.refs[i]);
        }
      }
      return gRefs;
    };
 
  };

  //*UTILITY FUNCTIONS*//

  function cacheParams(p){
    Logger.log('running cacheParams()!')
    // Logger.log('p.view.class: ' + p.view.class);
    // Logger.log('p.view.instance: ' + p.view.instance);
    self.cache = {params:{class: p.view.class, instance: p.view.instance, sheet: new Sheet(p.view.class+'Params', p.view.instance)}};
    var range = [[p.refs[0].names, p.refs[1].names, p.dates.start.setToMidnight(), p.dates.end.setToMidnight()]];
    if (p.view.instance == 'grid'){range[0].push(p.view.gridType);}

    self.cache.params.sheet.clearRange();
    self.cache.params.sheet.setRange(range);
    Logger.log('Finished running cacheParams()!');
  };

  function getParamsFromAltInstance(class, instance){
    Logger.log('running getParamsFromAltInstance()!');
    var params = new Sheet(class+'Params', instance).data[0];
    // for (var j in params){
    //   Logger.log('params['+j+']: ' + params[j])
    // }
    return {
      ref0Names: params.ref0names,
      ref1Names: params.ref1names,
      start: params.start,
      end: params.end,
      gridType: params.gridType
    };
  };

  function refreshRowMap(getRange){
    var range = getRange();
    self.cache.rowmap.sheet.clearRange();
    self.cache.rowmap.sheet.setRange(range);
    self.cache.rowmap.sheet = new Sheet(self.view.class+'GridMaps', 'rowmap');//refresh object mapping of sheet to reflect new range values
    return this;
  };

  function refreshCellMap(){
    Logger.log('running refreshCellMap()');
    var gm = self.gridMap, id = 0, range =[];
    // Logger.log('gm: ' + gm);
    // Logger.log('gm.length: ' + gm.length);
    for (var i = 0; i < gm.length; i++){//build cellmap range from grid row data
      for (var day in gm[i].info){
        for (var period in gm[i].info[day]){
          // Logger.log('gm['+i+'].info['+day+']['+period+'].recordIds: ' + gm[i].info[day][period].recordIds)
          for (var j = 0; j < gm[i].info[day][period].recordIds.length; j++){
            range.push([
              id,//id
              getRefIdFromName(0, gm[i].name),//ref0id
              gm[i].info[day][period].col,//col
              j,//index 
              gm[i].info[day][period].recordIds[j]//recordid
            ]);
            id++;
          }
        }
      }
    } 
    self.cache.cellmap.sheet.clearRange();
    self.cache.cellmap.sheet.setRange(range);
  };

  function getRMFromRange(){
    var range = [];
    for (var i = 0; i < self.view.sheet.data.length; i++) {
      range.push([
        getRefIdFromName(0, self.view.sheet.data[i][self.refs[0].nameKey]),//ref0id
        i + self.view.sheet.row.first//row
      ]);
    }
    return range;    
  };

  function getRMFromGridMap(){
    var range = [];
    for (var i=0; i < self.gridMap.length; i++){
      range.push([
        self.gridMap[i].id,//ref0name
        i + self.view.sheet.row.first//row
      ]);
    }
    return range;
  };

  function reconcileRefs (){
    Logger.log('running reconcileRefs()');
    for (var i = 0; i < self.refs.length; i++){
      reconcileRef(self.refs[i]);
    }
    // Logger.log('finished running reconcileRefs()');
  };

  function reconcileRef(ref){
    Logger.log('running reconcileRef('+ref.class+')')
    if (self.recordList !== undefined){
      var idKey = ref.idKey,
        oldNames = ref.names,
        newNames = [],
        ids = [];
      for (var i = 0; i < self.recordList.length; i++){
        if(
          self.recordList[i][idKey] !== undefined && 
          self.recordList[i][idKey] !== '' //&& 
          // typeof(self.recordList[i][idKey])=='number'
        ){
          ids.push(self.recordList[i][idKey]);
        }
      }
      // Logger.log('ids: ' + ids);
      ref.ids = ids.dedupe();
      // Logger.log('ref.ids: ' + ref.ids);
      // Logger.log('deduped ref ids');
      ref.names = getNamesFromIds(ref.sheet, ref.ids);  
    }
  };

  function getRecordsByRefId(ref, id){
    return self.getRecordsSortedByRef(ref)[id];
  };

  function getRowFromRecordId(id){
    for (var i = 0; i < self.view.sheet.data.length; i++) {
      if (self.view.sheet.data[i].id === id){
        return i + self.view.sheet.row.first;
      }
    };
  };

  function getGridRowColFromRecordId(id){
    for (var i = 0; i < self.cache.cellmap.sheet.data.length; i++) {
      if (self.cache.cellmap.sheet.data[i].recordid == id){
        return {
          row: getGridRowFromCellMapping(self.cache.cellmap.sheet.data[i]), 
          col: self.cache.cellmap.sheet.data[i].col
        };        
      }
    }
  };

  function getGridRowFromCellMapping(cm){
    for (var i = 0; i < self.cache.rowmap.sheet.data.length; i++) {
      if(self.cache.rowmap.sheet.data[i].ref0id == cm.ref0id){
        return self.cache.rowmap.sheet.data[i].row;
      }
    };
  };

  function getAmFromPeriod(period){
    if(period.indexOf('AM') >= 0){
      return true;
    } else {
      return false;
    }
  };

  function getPmFromPeriod(period){
    if(period.indexOf('PM') >= 0){
      return true;
    } else {
      return false;
    }
  };

  function getPeriodFromAmPm(am, pm){
    if (am && pm) {
      return 'AM/PM';
    } else if (am){
      return 'AM';
    } else {
      return 'PM';
    }
  };

  function getCodeFromStatus(status){
    var codes = {
      unassigned: '-u',
      proposed: '-p',//<-- GENERATED BY TESS COHEN. ANY USE OF THIS LINE OF CODE MUST BE ATTRIBUTED TO HER. TO GET HER PERMISSION, TWEET AT @LILPROTESTER
      delegated: '-d',
      confirmed: '-c',
      'cancelled free': '-xf',
      'cancelled charge': '-xc',
      'late free': '-lf',
      'late charge': '-lc',
      available: '-a',
      'not available': '-n',
      'emergency only': '-e'
    }
    return codes[status];
  };

  function getStatusFromCode(code){
    var statuses = {
      '-u': 'unassigned',
      '-p': 'proposed',//<-- GENERATED BY TESS COHEN. ANY USE OF THIS LINE OF CODE MUST BE ATTRIBUTED TO HER. TO GET HER PERMISSION, TWEET AT @LILPROTESTER 
      '-d': 'delegated',
      '-c': 'confirmed',
      '-xf': 'cancelled free',
      '-xc': 'cancelled charge',
      '-lf': 'late free',
      '-lc': 'late charge',
      '-a': 'available',
      '-n': 'not available',
      '-e': 'emergency only'
    }
    return statuses[code];
  };

  function getErrorStr(errorArr){
    var str = '';
    for (var i = 0; i < errorArr.length; i++) {
      str.concat(errorArr[i] + '\n');
    }
    return str;
  };
  //** ^^^ UTILITY FUNCTIONS ^^^ **//

  //** vvv INITIALIZE DATES vvv **//

  function initDates(){
    if (self.view.init === 'fromUi' || self.view.init === 'fromAltInstance' || self.view.init === 'fromLastWeek'){
      initDatesFromParams();
    } else if(self.view.init === 'fromRel'){
      initDatesFromRel();
    } else if(self.view.init === 'fromRange'){  
      self.newRecs ? initDatesFromParams() : initDatesFromCache();
    }
  };

  function initDatesFromParams(){
    self.dates = {
      start: self.p.dates.start.setToMidnight(),
      end: self.p.dates.end.setToMidnight(),
      weekMap: self.p.dates.start.getWeekMap()
    }
  };

  function initDatesFromCache(){
    self.dates = {
      start: self.cache.params.sheet.data[0].start,
      end: self.cache.params.sheet.data[0].end,
      weekMap: self.cache.params.sheet.data[0].start.getWeekMap()
    }
  };

  function initDatesFromRel(){
    self.dates = self.rel.view.dates;
  };

  //** ^^^ INITIALIZE DATES ^^^ **//

  //** vvv INITIALIZE REFS vvv **///

  function initRefs() {
    Logger.log('Running initRefs()');
    self.refs = [];
    
    if (self.view.init == 'fromRel'){
      // Logger.log('initializing refs from rel');
      self.refs[0] = self.rel.view.refs[1];
      self.refs[1] = self.rel.view.refs[0];
    } else if (self.view.init == 'fromLastWeek'){
      // Logger.log('initializing refs from last week');
      self.refs = self.lw.refs;
    } else {
      for (var i = 0; i < p.refs.length; i++){
        // Logger.log('Initalizing ref for ref with class: ' + p.refs[i].class + ' and instance: ' + p.refs[i].instance);
        self.refs[i] = {
          class: p.refs[i].class,
          instance: p.refs[i].instance,
          sheet: new Sheet(p.refs[i].class, p.refs[i].instance),
          nameKey: p.refs[i].class.slice(0, -1),
          idKey: p.refs[i].class.slice(0, -1) + 'id'
        };
        if (self.view.init == 'fromUi' || self.view.init == 'fromAltInstance'){
          var names = p.refs[i].names.split(', '); 
        } else if (self.view.init == 'fromRange'){        
          var names = self.cache.params.sheet.data[0]['ref' + i + 'names'].split(', ');
        } 
        initRefIdsFromNames(names, i);        
      }      
    }
    initRefAccessors();
    logRefErrors();
    Logger.log('Completed initRefs()!');
    // //LOG REFS (for testing only)
    // for (var i = 0; i < self.refs.length; i++) {
    //   for (var j in self.refs){
    // Logger.log('self.refs['+i+']: ' + self.refs[i]);
    //   }  
    // };
    // //LOG REF NAMES & IDS (for testing only)
    // for (var i = 0; i < self.refs.length; i++) {
    //   Logger.log(self.refs[i].nameKey + 'names: ' + self.refs[i].names);
    //   Logger.log(self.refs[i].idKey + 'ids: ' + self.refs[i].ids);
    // }
  };

  function initRefIdsFromNames(names, i){
    if (names == 'all'){//for param 'all', retrieve all active names and ids of entity type specified by ref
      self.refs[i].greedy = true;
      self.refs[i].ids = getActiveIdsFromModel(self.refs[i].sheet);
      self.refs[i].names = getActiveNamesFromModel(self.refs[i].sheet);//reset names from 'all' to list of all actual names in ref model
    } else {
      self.refs[i].greedy = false;
      self.refs[i].names = names;
      var result = getIdsFromNames(self.refs[i].sheet, names);//store result and check for errors
      if (result.error){//log any lookup errors
        self.errors['refs'][i] = 'ERROR: a list of ' + self.refs[i].nameKey + ' ids could not be retrieved because the user tried to search for a '+ self.refs[i].nameKey +'name that does not exist.';
      } else {//if no errors, add retrieved ids to the view object's ref object
        self.refs[i].ids = result;
      }
    }
  };

  function logRefErrors(){
    if (self.errors.refs !== undefined){
      toast(getErrorStr(self.errors.refs));
      Logger.log(getErrorStr(self.errors.refs));        
    }
  }
  //** ^^^ INITIALIZE REFS ^^^ **///

  //** vvv INITIALIZE VOLATILES vvv **///
  function initVols(){
    if (self.view.type == 'list'){
      self.vols = [self.refs[1].idKey, 'status'];
      if (self.view.class == 'schedule'){self.vols.concat(['billing', 'urgency', 'notes']);}
    } else {//for grid views
      self.vols = self.view.gridType == 'times' ? [self.refs[1].idKey, 'start', 'end'] : [self.refs[1].idKey, 'status'];
    }
    //LOG VOLS (for testing) 
    for (var i = 0; i < self.vols.length; i++) {
      Logger.log('vols[i]: ' + self.vols[i]);     
    }    
  };
  //** ^^^ INITIALIZE VOLATILES ^^^ **//

  //** vvv INITIALIZE FILTERS vvv **//
  function initFilters(){
    if (self.errors.refs === undefined){//only proceed if no errors initializing refs
      var view = self.view.instance;
        filterArr = [],//empty array to store filtering functions
        filterParams = {//map of filter params corresponding to view instances
          update:{matchAttrs: {attr: 'status', values: ['unassigned', 'proposed', 'delegated']}},
          lookup: {matchRefs: {type: 'exclusive', ngRefs: self.getNonGreedyRefs()}}
        },
        filters = {//filter functions
          date: {// if a record's start time is before or after the start and end in params, filter it
            args: {start: self.dates.start, end: self.dates.end},
            func: function(record, args){
              return (record.start.getTime() < args.start.getTime() || record.start.getTime() > args.end.getTime() + 86400000);
            }       
          },
          matchAttrs: {//if a record attribute doesn't match the values for that attribute specified in params, filter it
            args: {attr: undefined, values: undefined},
            func: function(record, args){
              if (args.values.indexOf(record[args.attr]) < 0){
                return true;
              } else {
                return false;
              }
            }
          },
          matchRefs: {//if a record's ref ids doesn't match view's active ref id's, filter it
            args: {type: undefined, ngRefs: undefined},
            func: function(record, args){
              //Logger.log('**Running matchRefs');
              var filter = args.type == 'exclusive' ? false : true; //default to not filter in exclusive search to filter in inclusive
              //Logger.log('init filter val: ' + filter);
              //Logger.log('args.type: ' + args.type);
              //Logger.log('args.ngRefs: ' + args.ngRefs);

              for (var i=0; i<args.ngRefs.length; i++){
                var argRef = args.ngRefs[i];
                // Logger.log('ref class:' + argRef.class);
                if (args.type == 'exclusive'){//filter if ids of *any* ref models don't match  
                  // Logger.log('record id:' + record[argRef.idKey]);
                  if (argRef.ids.indexOf(record[argRef.idKey]) < 0){
                    filter = true;
                  }
                } else {//filter if ids of *all* ref models don't match
                  if (argRef.ids.indexOf(record[argRef.idKey]) >= 0){
                    filter = false;
                  }
                }
              }
              return filter;
            }
          }
        };

      filterArr.push(filters.date);//always include date filter at first index of filters array
      //find filters given in params and set their arguments to those specified in params
      for (var filter in filterParams[view]){//loop through filters corresponding to view given in params
        for (var arg in filterParams[view][filter]){//loop through each fitler's args as given in params 
          // Logger.log('pfilters['+view+']['+filter+']['+arg+']: ' + pfilters[view][filter][arg]);
          if (arg in filters[filter].args){//find arg names in filter that match arg names in params 
          // Logger.log('pfilters['+view+']['+filter+']['+arg+']: ' + pfilters[view][filter][arg]);
            filters[filter].args[arg] = filterParams[view][filter][arg];//initialize filter arguments to values of corresponding args in params  
          }
        }
        filterArr.push(filters[filter]); //add initialized filter to filters array
      }
      // Logger.log('Completed initFilters()!')
      // Logger.log('filterArr.length: ' + filterArr.length);
      // Logger.log('filterArr.contents: ');
      // for (var i = 0; i < filterArr.length; i++) {
      //   Logger.log('filterArr['+i+'].func: ' + filterArr[i].func);
      // };
      self.filters = filterArr;
    }
  };

  //** ^^^ INITIALIZE FILTERS ^^^ **//

  //** vvv INITIALIZE RECORD LIST vvv **//

  function initRecordList(){
    if (self.errors.refs === undefined){//only proceed if there were no errors initializing refs
      Logger.log('starting initRecordList()!');
      self.recordList = [];
      if (self.view.init == 'fromUi' || self.view.init == 'fromAltInstance' || self.view.init == 'fromRel'){
        initRecordListFromModel();        
      } else if (self.view.init == 'fromRange'){
        initRecordListFromSelf();
      } else if (self.view.init == 'fromLastWeek'){
        initRecordListFromLastWeek();
      }
      if (self.recordList.length > 0 && !self.errors.recordList){
        reconcileRefs();
        initRecordAccessors();
        self.recordsSortedByRef = [
          self.getRecordsSortedByRef(self.refs[0]),
          self.getRecordsSortedByRef(self.refs[1])
        ];
        Logger.log('Completed initRecordList!');
      } else if (self.recordList.length < 0) {
        logNoRecordsError();
      }
      //LOG RECORD LIST (for testing only)
      // for (var i = 0; i < self.recordList.length; i++) {//log record list values
      //   for (var j in self.recordList[i]){
      //     Logger.log ('recordList['+i+']['+j+']: ' + self.recordList[i][j]);
      //   }
      // };
      // //LOG REF NAMES AND IDS
      // Logger.log('self.refs[0].names: ' + self.refs[0].names);
      // Logger.log('self.refs[0].ids: ' + self.refs[0].ids);
      // Logger.log('self.refs[1].names: ' + self.refs[1].names);
      // Logger.log('self.refs[1].ids: ' + self.refs[1].ids);
    }
  };

  function initRecordListFromModel(){
    for (var i = 0; i < self.model.sheet.data.length; i++){  
      if (!applyFilters(self.model.sheet.data[i])){//if a record matches filter criteria, skip it, if not, add it to the record list
        self.recordList.push(self.model.sheet.data[i]);
      }
    }    
  };

  function applyFilters(record){//cycle through all filter functions and return true if any of them return true
    for (var i = 0; i < self.filters.length; i ++){
      //Logger.log('Running filter w/ index: ' + i);
      //Logger.log('result of filter: ' + self.filters[i].func(record, self.filters[i].args));
      if (self.filters[i].func(record, self.filters[i].args)){//if any filter returns true, return true
        return true;
      } 
    }
    return false;//if no filters return true, return false
  };

  function initRecordListFromSelf(){
    Logger.log('running initRecordListFromSelf()');
    if (self.view.type == 'list'){
      // Logger.log('initiating from list.')
      for (var i = 0; i < self.view.sheet.data.length; i++){
        if (self.view.sheet.data[i].id === undefined || self.view.sheet.data[i].id === ''){//if no id is given (signifying a new record), populate record list row data from view row data
          var rec = getRecFromViewRow(self.view.sheet.data[i]);
        } else {//otherwise, populate record list row from volatile data from view row and stable data from model
          var volatileData = getVDFromSheetRow(self.view.sheet.data[i]),
            rec = getRecFromVD(volatileData);
        }
        self.recordList.push(rec);
      }
    } else {//for grid 
      // Logger.log('initiating from grid.')
      if (self.newRecs){//if this view is creating new records, get strings from all grid cells
        Logger.log('creating new records.')
        for (var i = 0; i < self.view.sheet.data.length; i++) {//loop through sheet rows
          var ref0id = getRefIdFromName(0, self.view.sheet.data[i][self.refs[0].nameKey]);//store ref0id
          Logger.log('ref0id: ' + ref0id);
          for (var j in self.view.sheet.data[i]) {//loop through sheet columns
            if (j.indexOf('Am')>=0 || j.indexOf('Pm')>=0){//only proceed for columns of type [DAY] [PERIOD] (by matching on period -- first letter capitalized to match google's [inconsistent!] header normalization)
              var col = self.view.sheet.headers.indexOf(j) + self.view.sheet.col.first;//store col num
              Logger.log('col: ' + col);
              if(self.view.sheet.data[i][j] !== undefined && self.view.sheet.data[i][j] !== ''){//only proceed if cell not empty
                var strs = self.view.sheet.data[i][j].split(', ');//create array of strings from cell contents
                Logger.log('strs: ' + strs);
                for (var k = 0; k < strs.length; k++) {//loop through strings
                  if (self.view.gridType == 'times'){
                    var volatileData = getVDFromTimeStr(strs[k], col,'', ref0id);//get time attributes from time strings
                    self.recordList.push(getNewRecFromTimeVD(volatileData, ref0id, k));//combine time attributes with default ref record values and push to recordList
                  } else {
                    var volatileData = getVDFromRefStr(strs[k], col, '');//get ref attributes from ref strings
                    self.recordList.push(getNewRecFromRefVD(volatileData, ref0id, col));//combine ref attributes with default time record values and push to recordList
                  }
                }
              }             
            }
          }
        }
      } else {//if the view is modifying existing records, get strings cached cell mappings 
        for (var i = 0; i < self.cache.cellmap.sheet.data.length; i++){//loop through cell map and retrieve attribute values
          Logger.log('i: ' + i);
          var  id = self.cache.cellmap.sheet.data[i].recordid, 
            col = self.cache.cellmap.sheet.data[i].col,
            ref0id = self.cache.cellmap.sheet.data[i].ref0id,
            index = self.cache.cellmap.sheet.data[i].index,
            row = getGridRowFromCellMapping(self.cache.cellmap.sheet.data[i]);//lookup grid row in row map
            Logger.log('row: ' + row);
            str = self.view.sheet.data[row - self.view.sheet.row.first][self.view.sheet.headers[col - self.view.sheet.col.first]].split(', ')[index],
            rec = {};
          if (self.view.gridType == 'times'){
            var volatileData = getVDFromTimeStr(str, col, id, ref0id);
          } else {
            var volatileData = getVDFromRefStr(str, col, id);
          } 
          self.recordList.push(getRecFromVD(volatileData));
        }        
      }
    }
  }; 

  function getRecFromViewRow(row) {
    // Logger.log('running getRecFromViewRow()');
    var rlRow = {};
    //define rl start and end attributes from view row date, start, and end attributes
    rlRow.start = new Date(row.date);
    rlRow.end = new Date(row.date);
    rlRow.start.setHours(row.start.getHours());
    rlRow.end.setHours(row.end.getHours());

    for (var attr in row){
      if (attr == 'day' || attr == 'date' || attr == 'start' || attr == 'end'){//skip view row attributes used to define rl start and end
        continue;
      } else if (attr == 'period'){//retrieve am & pm bool vals from period attr
        rlRow.am = getAmFromPeriod(row[attr]);
        rlRow.pm = getPmFromPeriod(row[attr]);
      } else if (row[attr] === undefined){//avoid ref lookups for undefined refs
        rlRow[attr] = '';
      } else if (isRef(attr)){//get ref ids for attributes that refer to refs
        var idKey = attr + 'id', 
          class = attr + 's';
        rlRow[idKey] = getRefIdFromName(getRefIndexFromClass(class), row[attr]);
        if (rlRow[idKey] === undefined){//handle ref lookup errors
          rlRow[idKey] = '';
          logRlRefLookupError(attr, row[attr]);
        } 
      } else {//otherwise populate rl attributes with attributes from view row
        rlRow[attr] = row[attr];
      }
    }
    return rlRow;
  };


  function getVDFromSheetRow(row){
    // Logger.log('running getVDFromSheetRow');
    var vd = {id: row.id};
    for (var i = 0; i < self.vols.length; i++){
      var vol = self.vols[i];
      Logger.log('vol: ' + vol);
      if (isRef(vol)){//if attr is a ref, lookup ref id from name
        var nameKey = vol.slice(0,-2),
          class = nameKey + 's';
        if (row[nameKey] === undefined){//avoid ref lookups for empty cells
          vd[vol] = '';
        } else {
          // Logger.log('doing ref lookup for ' + row[nameKey]);
          vd[vol] = getRefIdFromName(getRefIndexFromClass(class), row[nameKey]); 
          // Logger.log('vd['+vol+']: ' + vd[vol]);
          if (vd[vol] === undefined){//handle errors generated by trying to lookup non-existent names
            vd[vol] = '';
            logRlRefLookupError(nameKey, row[nameKey]);
          }          
        } 
      } else {//otherwise write row attribute to vd obj
        vd[vol] = row[vol];
      }
    }
    //LOG VD (for testing)
    // for (var i in vd) {Logger.log('vd['+i+']: ' + vd[ai])};
    return vd;
  };

  function getVDFromRefStr(str, col, id){    
    // Logger.log('running getVDFromRefStr()');
    var code = str.slice(str.indexOf('-'), str.length).trim(),
      ref1Name = str.slice(0, str.indexOf('-')).trim(),
      idKey = self.refs[1].idKey,
      vd = {
        id: id,
        status: getStatusFromCode(code)
      };
    if (ref1Name === ''){//avoid ref lookups for empty cells
      var ref1Id = '';
    } else {//lookup ref ids from ref names
      var ref1Id = getRefIdFromName(1, ref1Name);
      if (ref1Id === undefined) {//log any lookup errors
        ref1Id = '';
        logRlRefLookupError(self.refs[1].nameKey, ref1Name);
      }
    } 
    vd[idKey] = ref1Id;
    return vd;
  };

  function getVDFromTimeStr(str, col, id, ref0id){
    // Logger.log('running getVDFromTimeStr('+str+', '+col+', '+id+', '+ref0id+')');
    var date = getDateFromCol(col),
      period = getPeriodFromCol(col),     
      start = parseFormattedTime(date, str.trim().slice(0, str.indexOf('-') - 1)),
      end = parseFormattedTime(date, str.trim().slice(str.indexOf('-')+2, str.length));
      // Logger.log('*start: ' + start);
      // Logger.log('*end: ' + end);
    if (!start.error && !end.error){
      if (end.getTime() < start.getTime()){end = end.incrementDate(1);}//correct for end times after midnight
    }
    var rec = {
      id: id,
      start: start.error ? 'error' : start,
      end: end.error ? 'error' : end,
      am: period == 'am' ? true : false,
      pm: period == 'pm' ? true : false 
    };  
    rec[self.refs[0].idKey] = ref0id;
    return rec; 
  };

  function getDateFromCol(col){
    return self.dates.weekMap[self.view.sheet.headers[col-1].slice(0,3)];
  };

  function getPeriodFromCol(col){
    return self.view.sheet.headers[col-1].slice(3,5).lowerFirstChar();
  };

  function parseFormattedTime(date, ft){
    // Logger.log('running parseFormattedTime('+date+', '+ ft+')');
    if (!timeHasCorrectFormat(ft)){
      logRlTimeFormatError(ft);
      return {error: true};      
    } else {
      var date = new Date(date.toDateString()),
        period = ft.slice(-2, ft.length),
        hr = period == 'am' ? parseAmHours(Number(ft.slice(0, ft.indexOf(':')))) : parsePmHours(Number(ft.slice(0, ft.indexOf(':')))), 
        min = Number(ft.slice(ft.indexOf(':') +1, -2));      
      date.setHours(hr);
      date.setMinutes(min);
      return date;       
    }
  };

  function timeHasCorrectFormat(ft){
    Logger.log('running timeHasCorrectFormat('+ft+')');
    Logger.log('ft.length: ' + ft.length);
    if (ft.indexOf(':') < 0){return false;}
    if (ft.indexOf('am') < 0 && ft.indexOf('pm') < 0){return false;}
    if (ft.length < 6 || ft.length > 7){return false;}
    return true;
  };


  function parseAmHours(hr){
    if (hr == 12){return 0;} else {return hr;}
  };

  function parsePmHours(hr){
    if (hr == 12){return 12;} else {return hr + 12;}
  };

  function getRecFromVD(vd){
    var id = vd.id, rec = {};
    for (var attr in vd){rec[attr] = vd[attr];}//retrieve all volatile values from vd{}
    for (var attr in self.model.sheet.data[id]){//retrieve all stable values (ie values not attributes of vd{}), from model
      if (!(attr in vd)){rec[attr] = self.model.sheet.data[id][attr];}
    }
    return rec;
  };

  function getNewRecFromTimeVD(vd, ref0id, index){
    vd[self.refs[0].idKey] = ref0id;
    if (self.view.class == 'availability'){
      vd.status = 'available';
      return vd;
    } else if (self.view.class == 'schedule'){
      vd.status = 'unassigned';
      vd.urgency = 'weekly';
      vd.billing = index > 0 ? 'extra rider' : 'normal';
      return vd;
    }
  };

  function getNewRecFromRefVD(vd, ref0id, col){
    // Logger.log('running getNewRecFromRefVD('+vd+', '+col+')');
    vd[self.refs[0].idKey] = ref0id;
    if (self.view.class == 'availability'){
      var period = getPeriodFromCol(col);
      vd.start = new Date(getDateFromCol(col).toDateString());
      vd.end = new Date(getDateFromCol(col).toDateString());
      vd.am = period == 'am' ? true : false;
      vd.pm = period == 'pm' ? true: false;
      return vd;
    } else if (self.view.class == 'schedule'){
      vd.urgency = 'weekly';
      vd.billing = index > 0 ? 'extra rider' : 'normal';
      return vd;
    }
  };

  function initRecordListFromLastWeek(){
    Logger.log('running initRecordListFromLastWeek()');
    self.recordList = self.lw.recordList;//clone last week's record list
    for (var i = 0; i < self.recordList.length; i++) {
      for (var j in self.recordList[i]){
        if (j.indexOf('id') >= 0 && j !== self.refs[0].idKey){//set all id attributes to undefined except ref0 ids
          self.recordList[i][j] = '';
        } else if (j == 'status'){//set status of all records to unassigned
          self.recordList[i][j] = 'unassigned';
        } else if (j == 'urgency'){//set urgency of all records to weekly
          self.recordList[i][j] = 'weekly';
        } else if (j == 'start' || j == 'end'){//increment all dates by 7 days
          self.recordList[i][j] = self.recordList[i][j].incrementDate(7);
        }
      }
    }
  };

  function logRlRefLookupError(nameKey, name){
    Logger.log('running logRecordListError()');
      self.errors.recordList = self.errors.recordList || [];
    var error = 'ERROR: There was no ' + nameKey + ' found with name ' + name + '. (' + name + ' is either not in the database or their status is inactive.)';
    self.errors.recordList.push(error);//quotes and brackets in case error obj or error.recordList array not yet defined
    Logger.log(error);
    toast(error);
  };

  function logRlTimeFormatError(ft){
    self.errors.recordList = self.errors.recordList || [];
      var error = 'ERROR: you provided an incorrectly formatted time: ' + ft;
      toast(error);
      Logger.log(error);
  };

  function logNoRecordsError(){
    var message = 'ERROR: there were no records in the ' + self.view.class + ' model matching '
    self.view.init == 'fromRel' ? message.concat('the records in this ' + self.view.class + 'view.') : message.concat('the paramaters you inputed');
    self.errors.recordList = message;
    Logger.log(message);
    toast(message);
  };


  //** ^^^ INITIALIZE RECORD LIST ^^^ **//

  //** vvv INITIALIZE GRID MAP vvv **//

  function initGridMap(){
    if(self.errors.recordList === undefined){
      Logger.log('Running initGridMap()!');
      // var names = self.refs[0].names;
      self.gridMap = [];
      // Logger.log('names: ' + names);
      // for (var i = 0; i < self.cache.rowmap.sheet.data.length; i++){
      //   self.gridMap.push({
      //     id: self.cache.rowmap.sheet.data[i].ref0id,
      //     name: getRefNameFromId(0, self.cache.rowmap.sheet.data[i].ref0id),
      for (var i = 0; i < self.refs[0].names.length; i++){
        self.gridMap.push({
          name: self.refs[0].names[i],
          id: self.refs[0].ids[i],
          info: {
            mon: {
              am: {recordIds: [], col: 2}, 
              pm: {recordIds: [], col: 3}
            },
            tue: {
              am: {recordIds: [], col: 4}, 
              pm: {recordIds: [], col: 5}
            },
            wed: {
              am: {recordIds: [], col: 6}, 
              pm: {recordIds: [], col: 7}
            },
            thu: {
              am: {recordIds: [], col: 8}, 
              pm: {recordIds: [], col: 9}
            },
            fri: {
              am: {recordIds: [], col: 10}, 
              pm: {recordIds: [], col: 11}
            },
            sat: {
              am: {recordIds: [], col: 12}, 
              pm: {recordIds: [], col: 13}
            },
            sun: {
              am: {recordIds: [], col: 14}, 
              pm: {recordIds: [], col: 15}
            }          
          }
        });      
      }
      initGridMapRecordIds();
      // Logger.log('finished running initGridMap()!');
      // //LOG GRID MAP (for testing)
      // for (var i = 0; i < self.gridMap.length; i++){
      //   for (var day in self.gridMap[i].info){
      //     for (var period in self.gridMap[i].info[day]){
      //       Logger.log('self.gridMap['+i+'].info['+day+']['+period+'].recordIds: ' + self.gridMap[i].info[day][period].recordIds);
      //     }
      //   }
      // }    

    }
  };

  function initGridMapRecordIds(){
    Logger.log('running initGridMapRecordIds()');
    for (var i = 0; i < self.gridMap.length; i++){
      for (var day in self.gridMap[i].info){
        for (var period in self.gridMap[i].info[day]){
          self.gridMap[i].info[day][period].recordIds = initRecordIdsForGridCell(i, day, period);
        }
      }
    }
    Logger.log('finished running initGridRecordIds()!'); 
  };

  function initRecordIdsForGridCell(index, day, period){
    // Logger.log('running initRecordIdsforGridCell('+index+', '+day+', '+period+')');
    var am = (period == 'am') ? true : false,
      pm = !am,
      date = self.dates.weekMap[day],
      refIdKey = self.refs[0].idKey,
      refId = self.gridMap[index].id,
      recIds= [];
      // Logger.log('date: ' + date);
      // Logger.log('id:' + id);
      // Logger.log('idKey: ' + idKey);

    for (var i = 0; i < self.recordList.length; i++){
      // Logger.log('self.recordList['+i+']['+idKey+']: ' + self.recordList[i][idKey]);
      // Logger.log('self.recordList['+i+'].start: ' + self.recordList[i].start);
      if (
        self.recordList[i][refIdKey] == refId &&
        self.recordList[i].am == am && 
        self.recordList[i].pm == pm && 
        self.recordList[i].start.getYear() == date.getYear() &&
        self.recordList[i].start.getMonth() == date.getMonth() &&
        self.recordList[i].start.getDate() == date.getDate()
      ) {
        if (self.view.init == 'fromLastWeek'){//for records w/o ids, use the record's index in the recordList as a temp record id
          recIds.push(i);
        } else {//for existing records, use the record id stored in the model
          recIds.push(self.recordList[i].id);  
        }
        
      }
    }
    return recIds;
  };

  //** ^^ INITIALIZE GRID MAP ^^ **//

  //** vvv INITIALIZE RANGE vvv **//
  function initRange(){
    Logger.log('Running initRange()!')
    if (self.errors.recordList === undefined){//only proceed if there were no errors retrieving record list
      self.range = [];
      if (self.view.type == 'list'){
        initListRange();
      } else {
        initGridRange();
      }      
    }
    Logger.log('Finished running initRange()!');
    // //LOG RANGE (for testing)
    // for (var i = 0; i < self.range.length; i++) {
    //   Logger.log('self.range['+i+']: ' + self.range[i]);
    // }
  };

  function initListRange(){
    var headers = self.view.sheet.headers;
    for (var i = 0; i < self.recordList.length; i++)  {
      self.range[i] = [];
      for (var j = 0; j < headers.length; j++){
        self.range[i].push(initListRangeCellVal(self.recordList[i], headers[j]));
      }
    }
  };

  function initListRangeCellVal(record, header){
    if (header in record){//if the data type in the record list matches the data type specified by the header, return the value without formatting
      return record[header] === undefined ? '' : record[header];
    } else if (isRef(header)){//if the header refers to a ref name, return the name corresponding to the ref id     
      var idKey = header + 'id',
        class = header + 's';
      return (record[idKey] === undefined || record[idKey] === '') ? '' : getRefNameFromId(getRefIndexFromClass(class), record[idKey]);
    } else {//otherwise format the value according to the following patterns
      var headers = {
        day: record.start.getDayName(),
        date: record.start.getFormattedDate(),
        start: record.start.getFormattedTime(),
        end: record.end.getFormattedTime(),
        period: getPeriodFromAmPm(record.am, record.pm)
      }
      return headers[header];
    }
  };

  function initGridRange(){
    // Logger.log('running initGridRange()!');
    for (var i = 0; i < self.gridMap.length; i ++){
      self.range.push(initGridRangeRow(i));
    }
  };

  function initGridRangeRow(i){
    var row = [];
    row[0] = self.gridMap[i].name;
    for (var day in self.gridMap[i].info){
      for (var period in self.gridMap[i].info[day]){
        row.push(initGridRangeCellVals(self.gridMap[i].info[day][period].recordIds));
      }
    }
    return row;
  };

  function initGridRangeCellVals(recordIds){
    // Logger.log('Running initGridRangeCellVals('+recordIds+')!');
    var cell = [];
    for (var i = 0; i < recordIds.length; i++){
      var rec = self.view.init == 'fromLastWeek' ? self.recordList[recordIds[i]] : self.getRecordFromId(recordIds[i]);
        idKey = self.refs[1].idKey,
        str = getGridRecordString(rec, idKey);
        // Logger.log('str: ' + str);
      cell.push(str);
    }
    cell = cell.join(', ');
    // Logger.log('Finished running initGridRangeCellVals()!');    
    // Logger.log('cell: ' + cell);
    return cell;
  };

  function getGridRecordString(rec, idKey){
    // Logger.log('running getGridRecordString('+rec+', '+idKey+')');
    if (self.view.gridType == 'refs'){
      if (rec.status === undefined){
        return '';
      } else {
        var refName = (rec[idKey] === undefined || rec[idKey] === '')? '' : getRefNameFromId(1, rec[idKey]);
        return refName + ' ' + getCodeFromStatus(rec.status);
      }
    } else if (self.view.gridType == 'times'){
      return rec.start.getFormattedTime() + ' - ' + rec.end.getFormattedTime();
    }
  };

  //** ^^ INITIALIZE RANGE ^^ **//

  //* vvv SEND EMAILS vvv *//

  this.sendEmails = function (){

    Logger.log('running this.sendEmails()!');
    toast('Sending emails...');

    var ee = {}, er = {}, ep = {}, user = Session.getActiveUser().getEmail(), emailCount = 0;

    initEmailRecords();
    initEmailElements();
    
    for (var refId in er){
      refId = Number(refId);
      setUrgencies(refId);
      initEmailParams(refId);
      sendEmail(refId);
      setStatuses(refId);
    };

    toast(emailCount + ' emails sent!');
    return this;

    function initEmailRecords(){
      Logger.log('running initEmailRecords()');
      Logger.log('typeof refId: ' + typeof refId);
      for (var refId in self.recordsSortedByRef[1]){
        for (var i = 0; i < self.recordsSortedByRef[1][refId].length; i++){
          if (self.recordsSortedByRef[1][refId][i].status == 'proposed'){
            Logger.log('self.recordsSortedByRef[1]['+refId+']['+i+'].start: ' + self.recordsSortedByRef[1][refId][i].start);
            if (er[refId] === undefined){er[refId] = [];}
            er[refId].push(self.recordsSortedByRef[1][refId][i]);
          }
        }
      }
      Logger.log('Finished running initEmailRecords()');
      //LOG RECS (for testing)
      for (var refId in er){
        for (var i = 0; i < er[refId].length; i++) {
          for (var j in er[refId][i]){
            Logger.log('er['+refId+']['+i+']['+j+']: ' + er[refId][i][j]);
          }
        }
      }
      // //LOG REF NAMES & IDS (for testing)
      // Logger.log('self.refs[1].ids: ' + self.refs[1].ids);
      // Logger.log('self.refs[1].names: ' + self.refs[1].names);
      // Logger.log('self.refs[0].ids: ' + self.refs[0].ids);
      // Logger.log('self.refs[0].names: ' + self.refs[0].names);
    };

    function initEmailElements(){
      ee.notes = new Sheet('emailElements', 'notes');
      ee.reminders = new Sheet('emailElements', 'reminders');
      ee.users = new Sheet('emailElements', 'users');
      ee.user = getRecordFromModelById(ee.users, user);
    };

    function setUrgencies(refId){
      Logger.log('runnning setUrgencies()');
      var now = new Date();
      for (var i = 0; i < er[refId].length; i++) {
         if (now.getWeekMap().mon.getTime() != er[refId][i].start.getWeekMap().mon.getTime()){
          er[refId][i].urgency = 'weekly';
        } else {
          var dif = er[refId][i].start - now;
          if (dif >= 129600000){//129600000 is 36 hours in milliseconds
            er[refId][i].urgency = 'extra';
          } else {
            er[refId][i].urgency = 'emergency';
          }        
        }       
      }
    };

    function initEmailParams(refId){
      Logger.log('running initEmailParams()');  
      var emailType = getEmailType(er[refId]);
      ep[refId] = {
        to: self.refs[1].sheet.data[refId].email,
        // bcc: 'brooklynshift@gmail.com',
        name: ee.user.name,
        subject: getSubject(er[refId], emailType, refId),
        htmlBody: getBody(refId, er[refId], emailType)
      };
      
      function getEmailType(recs){//loop through records and return 'extra' if any shifts are 'extra', otherwise return 'emergency'
        if (recs[0].urgency == 'weekly'){
          return 'weekly';
        } else {
          for (var i = 0; i < recs.length; i++){
            if (recs[i].urgency == 'extra'){return 'extra';}
          } 
          return 'emergency';      
        }
      };

      function getSubject(recs, emailType, refId){
        Logger.log('Running getSubject('+recs+', '+emailType+') for rider id: ' + refId);
        var dateStr = getDateStr(recs),
          ref0NameStr = getRef0NameStr(recs);
        if (emailType == 'weekly'){
          return '[BK SHIFT SCHEDULE] ' + formatDate(self.dates.weekMap.mon) + ' - ' + formatDate(self.dates.weekMap.sun);
        } else if (emailType == 'extra'){
          return recs.length > 1 ? '[EXTRA SHIFTS]: ' + dateStr : '[EXTRA SHIFT]: ' + dateStr + ' at ' + ref0NameStr;
        } else {
          return recs.length > 1 ? '[EMERGENCY SHIFTS]: ' + dateStr : '[EMERGENCY SHIFT]: ' + dateStr +' at ' + ref0NameStr;
        }
      };

      function getDateStr(recs){
        var dates = [];
        for (var i = 0; i < recs.length; i++) {
          dates.push(formatDate(recs[i].start));
        };
        return dates.dedupe().join(', ');
      };

      function getRef0NameStr(recs){
        var ref0Names = [];
        for (var i = 0; i < recs.length; i++) {
          ref0Names.push(getRefNameFromId(0, recs[i][self.refs[0].idKey]));
        };
        return ref0Names.dedupe().join(', ');
      }

      function formatDate(date){
        return (date.getMonth() +1).toString() + '/' + date.getDate().toString();
      };

      function getBody(refId, recs, emailType){
        var greeting = getGreeting(refId),
          offering = getOffering(recs, emailType),
          sked = getSked(recs),
          notes = getNotes(recs, emailType),
          signature = getSignature(),
          briefs = getBriefs(recs),
          reminders = getReminders();
        return greeting + offering + sked + notes + signature + briefs + reminders;
      };

      function getGreeting(refId){
        return '<p>Hi ' + getRefNameFromId(1, refId).slice(0,-2) + '! ';//slicing removes space and last initial from shortname
      };

      function getOffering(recs, emailType){
        if (emailType == 'weekly'){
          return 'We&rsquo;d like to offer you the following schedule this week:</p>';
        } else if (recs.length > 1) {
          return 'We&rsquo;d like to offer you the following ' + emailType + ' shifts:</p>';
        } else {
          return 'We&rsquo;d like to offer you the following ' + emailType + ' shifts:</p>';
        }
      };

      function getSked(recs){
        Logger.log('running getSked()');
        var header = '<p><table style="border-collapse: collapse;"><tr><th style = "border: 1px solid black; padding: .5em; margin:0; background-color: #d8d8d8">Day</th><th style = "border: 1px solid black; padding: .5em; margin:0; background-color: #d8d8d8">Time</th><th style = "border: 1px solid black; padding: .5em; margin:0; background-color: #d8d8d8">Restaurant</th></th></tr>',
          footer = '</table></p>',
          rows = [];

        for (var i = 0; i < recs.length; i++) {
          // Logger.log('recs['+i+'].start: ' + recs[i].start);
          // Logger.log('recs['+i+'].start.getDayName(): ' + recs[i].start.getDayName());
          // Logger.log('formatDate(recs['+i+'].start: ' + formatDate(recs[i].start));
          rows[i] = '<tr><td style = "border: 1px solid black; padding: .5em; margin:0">' + recs[i].start.getDayName() + ' ' + formatDate(recs[i].start) + '</td><td style = "border: 1px solid black; padding: .5em; margin:0">' + recs[i].start.getFormattedTime() + ' - ' + recs[i].end.getFormattedTime() +'</td><td style = "border: 1px solid black; padding: .5em; margin:0">'+ getRefNameFromId(0, recs[i][self.refs[0].idKey])+'</td>';
        };
        return header + rows.join('</tr>') + footer;
      };

      function getNotes(recs, emailType){
        var now = new Date();
        if (emailType == 'weekly'){
          var header = '<p><strong>Please read the restaurant descriptions below and confirm your schedule by 6pm this Saturday.</strong></p><strong><span style="text-decoration: underline;">Notes:</span></strong></p><ul><li>',
            footer = '</li></ul>'
            n = [];
            for (var i = 0; i < ee.notes.data.length; i++){
              n.push(ee.notes.data[i].notes);
            };
          return header + n.join('</li><li>') + footer;
        } else if (recs.length > 1) {
          return '<p>Please confirm if you can work them by 2pm tomorrow ('+now.incrementDate(1).getDayName()+'). Thanks!</p>';
        } else {
          return '<p>Please confirm if you can work it by 2pm tomorrow ('+now.incrementDate(1).getDayName()+'). Thanks!</p>';
        }
      };

      function getSignature(){
        var salutation = '<p>Best,</p><p>',
          company = 'BK Shift, LLC<br/>',
          footer = '</p>';

        return salutation + ee.user.name + '<br/>' + ee.user.title +'<br/>'+ company + ee.user.email +'<br/>'+ ee.user.phone +'<br/>'+ footer;
      };

      function getBriefs(recs){
        var header = '<hr/><p><strong><span style="text-decoration: underline;">Restaurant Briefs:</span></strong><p>',
          refIds = getRefIdsFromEmailRecords(recs, 0);
          briefs = [];
        for (var i = 0; i < refIds.length; i++) {
          Logger.log('refIds['+i+']: ' + refIds[i]);
          var refRec = self.refs[0].sheet.data[refIds[i]],
            brief = '<p><strong>' + refRec.name + '[' + refRec.borough + ']:</strong> ' + refRec.brief + '<br/>' + '<strong>Location: ' + refRec.address + '</strong></p>'
          briefs.push(brief);
        };
        briefs.dedupe();
        return header + briefs.join('');
      };

      function getRefIdsFromEmailRecords(recs, refIndex){
        var refIds = [];
        for (var i = 0; i < recs.length; i++) {
          refIds.push(recs[i][self.refs[refIndex].idKey]);
        }
        return refIds.dedupe();    
      };

      function getReminders(){
        var header = '<hr/><p><strong><span style="text-decoration: underline;">Reminders:</span></strong><ol><li>',
          footer = '</li></ol></p>',
          r = [];
        for (var i = 0; i < ee.reminders.data.length; i++) {
          r.push(ee.reminders.data[i].reminders);
        };
        return header + r.join('</li><li>') + footer;
      };
    };

    function sendEmail(refId){
      MailApp.sendEmail(ep[refId]);
      emailCount++
    };    

    function setStatuses(refId){
      for (var i = 0; i < er[refId].length; i++) {
        self.getRecordFromId(er[refId][i].id).status = 'delegated';
      }
    };

  };
  //* ^^^ SEND EMAILS ^^^ *//

  //* vvv UPDATE CALENDAR vvv //

  this.writeToCalendar = function (){
    toast('Updating calendar...')
    var calendars = getCals(self.refs[0].ids);

    for (var i = 0; i < this.recordList.length; i++){//loop through all records in view
      var refId = this.recordList[i][this.refs[0].idKey],
        eventId = this.recordList[i].eventid,
        calCode = getCalCode(this.recordList[i][this.refs[1].idKey], this.recordList[i].status);
        // Logger.log('refId: ' + refId);
        // Logger.log('eventId:' + eventId);
        // Logger.log('calCode: ' + calCode);
     if (eventId !== '' && eventId !== undefined){//if a event exists, update it
        // Logger.log('updating the event with eventId' + eventId);
        getEventById(refId, eventId).setTitle(calCode);
     } else {//if not, create one
        // Logger.log('creating an event for the shift with shiftId: ' + shift.id);
        createEvent(calendars[this.recordList[i][this.refs[0].idKey]].cal, this.recordList[i], calCode);        
     }
    }
    toast('Calendar successfully updated!');
    return this;

    //** v CLOSURES v **//

    //** v GET CALS v**//
    function getCals(refIds){
      Logger.log('running getCals()');
      var cals = {};
      for (var i = 0; i < refIds.length; i++){
        var calObj = CalendarApp.getCalendarById(self.refs[0].sheet.data[refIds[i]].calendarid);
        cals[refIds[i]] = {cal: calObj, events: getEventsFromCalendar(calObj, refIds[i])};
      }
      Logger.log('finished running getCals()');
      //LOG CALS (for testing)
      // for (var i in cals){for (var j in cals[i].events){Logger.log('cals['+i+'].events['+j+'] ' + cals[i].events[j]);}}
      return cals;
    };

    function getEventsFromCalendar(calendar, refId){
      Logger.log('running getEventsFromCalendar('+calendar+', '+refId+')');
      var events = {};//construct events obeject w/ event id as key and event object as value
      for (var i = 0; i < self.recordList.length; i++){//loop through records, match on refId & exclude rows w/o eventids
        var eventid = self.recordList[i].eventid;//store eventid
        if (refId == self.recordList[i][self.refs[0].idKey] && eventid !== '' && eventid !== undefined){//retrieve calendar events corresponding to the restaurant and the shifts's time
          // Logger.log('Match found! eventId: ' + eventId);
          var tempEvents = calendar.getEvents(self.recordList[i].start, self.recordList[i].end);//store temp array of all events matching the shift's start and end time
          for (var j = 0; j < tempEvents.length; j++){
            events[tempEvents[j].getId()] = tempEvents[j]//add each event to the events object with the event id as key and the event object as value
          }        
        }
      }
      Logger.log('finished running getEventsFromCalendar()');
      return events;
    };
    //* ^ GET CALS ^ *//

    function getCalCode(refId, status){
      Logger.log('running getCalCode('+refId+', '+status+')');
      // Logger.log('riderid: ' + riderid);
      // Logger.log('riderid.length > 0 ? : ' + riderid != '');
      var refName = refId !== '' && refId !== undefined ? getRefNameFromId(1, refId) : '';
      // Logger.log ('rider: ' + rider);
      var  calCodes = {
        unassigned: '???',
        proposed: '*' + refName + '? (p)',
        delegated: '*' + refName + '? (d)',
        confirmed: refName + ' (c)',
        'cancelled free': 'CANCELLED - NO CHARGE',
        'cancelled charge': 'CANCELLED - CHARGE'
      };
      return calCodes[status];
    };

    function getEventById(refId, eventId){
      // Logger.log('running getEventById');
      // Logger.log('calendars['+refId+'].events['+eventId+']: ' + calendars[refId].events[eventId]);
      return calendars[refId].events[eventId];
    };

    function createEvent(calendar, rec, calCode){
      var event = calendar.createEvent(calCode, rec.start, rec.end); 
      rec.eventid = event.getId();
      Logger.log('rec.eventid: ' + rec.eventid);
    };

    // if (!calExists(restaurants, schedule[i].restaurantid)){//check to see if calendars exist for all restaurants being updated
    //   //if any calendars don't exist, throw an error message warning the user to create one and proceed
    //   toast('ERROR: There is no calendar for ' + schedule[i].restaurantname + '. Please go to the restaurants model and create one.')
    // }

    // function calExists(restaurantId){
    //   if(CalendarApp.getCalendarById(restaurants.data[restaurantId].calendarid) !== undefined){
    //     return true;
    //   } else {
    //     return false;
    //   }
    // };
  };
  //* ^^^ UPDATE CALENDAR ^^^ *//

};



//*** vvv UI APP vvv ***//

function initUi(serverHandler){//initiate UI dialog

  Logger.log('running initUI('+serverHandler+')');
  //get sheet and sheet index to determine view to pass to click handler
  var ss = SpreadsheetApp.getActiveSpreadsheet().getName(),
    ws = SpreadsheetApp.getActiveSheet().getName();
    Logger.log('ss: ' + ss);
    Logger.log('ws: ' + ws);
    sheet = new Sheet(ss, ws),
    ref1 = ss == 'schedule' ? 'riders' : 'restaurants',
  //retrieve view's current start and end dates from sheet data
    curStart = new Date().getWeekStart(),
    curEnd = curStart.incrementDate(6);
    
  //construct ui app
  var titles = {
      refreshView: 'Refresh ' + ss + ' view',
      cloneLastWeek: 'Clone last week\'s '+ ss,
      createRecords: 'Create new '+ ss +' records:'
    } 
    app = UiApp.createApplication().setTitle(titles[serverHandler]).setWidth(200).setHeight(240),
    //construct panel to hold user input elements
    panel = app.createVerticalPanel(),
    //construct ui elements to retrive and store paramaters to pass to updateShiftsView()
    class = app.createHidden('class', ss).setName('class').setId('class'),
    instance = app.createHidden('instance', ws).setName('instance').setId('instance'),//store sheet name as 'view'
    startLabel = app.createLabel('Start Date').setId('startLabel'),
    start = app.createDateBox().setName('start').setId('start').setValue(curStart),
    endLabel = app.createLabel('End Date').setId('endLabel'),
    end = app.createDateBox().setName('end').setId('end').setValue(curEnd),
    //define callback
    submitHandler = app.createServerHandler(serverHandler)
      .setId('submitHandler')
      .addCallbackElement(class)
      .addCallbackElement(instance)
      .addCallbackElement(start)
      .addCallbackElement(end);
  //for lookup view, retrieve restaurants and riders from user input 
  if (ws == 'lookup'){
    var restaurantsLabel = app.createLabel('Restaurants').setId('restaurantsLabel'),    
      restaurants = app.createTextBox().setName('restaurants').setId('restaurants').setValue('all'),
      ridersLabel = app.createLabel('Riders').setId('ridersLabel'), 
      riders = app.createTextBox().setName('riders').setId('riders').setValue('all'); 

  } else { //for all other views, store 'all' restaurants as hidden paramater 
    var restaurants = app.createHidden('restaurants', 'all').setName('restaurants').setId('restaurants'),
      riders = app.createHidden('riders', 'all').setName('riders').setId('riders');
  }
  submitHandler
    .addCallbackElement(restaurants)
    .addCallbackElement(riders);
  
  if (ws == 'grid'){
    var gridTypeLabel = app.createLabel('Grid Type').setId('gridTypeLabel'),
      gridType = app.createListBox().setName('gridType').setId('gridType');
    gridType.setVisibleItemCount(2);
    gridType.addItem('refs');
    gridType.addItem('times');
    gridType.setSelectedIndex(0);
  } else {
    gridType = app.createHidden('gridType', 'refs').setName('refs').setId('refs');
  }
  submitHandler.addCallbackElement(gridType);

  //define button to trigger callback
  var submit = app.createButton('Submit!').addClickHandler(submitHandler);
  
  //add app elements to each other (funky order here?)
  panel.add(startLabel).add(start).add(endLabel).add(end);
  if (ws == 'lookup'){panel.add(restaurantsLabel).add(restaurants).add(ridersLabel).add(riders);}
  if (ws == 'grid'){panel.add(gridTypeLabel).add(gridType);} 

  panel.add(submit);
  app.add(panel);

  //  sheet.g.getParent().show(app);
  SpreadsheetApp.getActiveSpreadsheet().show(app);
};

//** ^^ UI APP ^^ **//