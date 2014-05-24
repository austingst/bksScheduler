// Written by Austin Guest, 2014. 
// This is free software licensed under the GNU General Public License v3. 
// See http://www.gnu.org/licenses/gpl-3.0.txt for terms of the license.

//URL FOR TEST RESULTS: https://script.google.com/a/macros/bkshift.com/s/AKfycby3TGiZ_jVpfdy5b2nP6QZ8r6kAAWVjqaXqlm6GI8M/dev

//** CALLING FUNCTIONS *//

QUnit.helpers(this);

function doGet(e) {
  QUnit.urlParams( e.parameter );
  QUnit.config({ title: "Unit tests for BKS Scheduler scripts" });
  QUnit.load(tests);
  return QUnit.getHtml();
};

function tests(){
  testSortByDate();
  testGetInvoiceTitle();
  testCreateInvoiceSheet();
  testInvoiceMethods();
  testDeleteFromList();
};


//** TESTS **//

function testDeleteFromList(){
  var list = [{
      id: 0,
      name: 'Artem'
    },{
      id: 1,
      name: 'Cristian'
    },{
      id: 2,
      name: 'Charlie'
    }],
    expectedList = [{
      id: 0,
      name: 'Artem'
    },{
      id: 2,
      name: 'Charlie'
    }];
  list = deleteFromList(list, 1);
  test('deleteFromList() removes list element properly', function(){
    equal(list, expectedList);
  });
};

function deleteFromList(list, id){
  list = _.reject(list, function (row){
    return row.id === id;
  });
};

function testCreateInvoiceSheet(){
  var now = new Date(); 
    title = getInvoiceTitle(now) + '__TEST__',
    ss = SpreadsheetApp.create(title),
    key = ss.getId(),
  ss.getSheets()[0]
    .setName('index')
    .getRange(1,1)
      .setValue('INVOICES');
  var sheet = new Sheet(key, 'index');

  test('createInvoiceSheet() creates new sheet', function(){
    equal(ss.getId().length > 0, true, 'creates new google spreadsheet');
    equal(sheet.hasOwnProperty('class'), true, 'creates new Sheet Object')
  });

  var folderName = 'Restaurant Invoices',
    fileId = sheet.id;
  moveFileToFolder(fileId, folderName);

  test('moveFileToFolder() moves file to folder', function(){
    equal(hasFile(folderName, fileId), true);
  });

  function hasFile(folderName, fileId){
    var file = DriveApp.getFileById(fileId),
      folders = file.getParents();
    return folders.next().getName() == folderName;
  };
};

function testGetInvoiceTitle(){
  var dates = {
    md: new Date(2014, 4, 12), //tests week from 5/5 - 5/11
    mmd: new Date(2014, 9, 13), //tests week from 10/6 - 10/12
    mdd: new Date(2014, 4, 19), //tests week from 5/12 - 5/18
    mmdd: new Date(2014, 9, 20) //tests week from 10/13 - 10/19
  };
  test('get invoice tittle (M/D)', function(){
    var title = getInvoiceTitle(dates.md),
      expectedTitle = 'RestaurantInvoices_2014_0505_0511';
    equal(title, expectedTitle, 'Creates correct invoice title for 1-digit month w/ 1-digit day');
  });
  test('get invoice tittle (MM/D)', function(){
    var title = getInvoiceTitle(dates.mmd),
      expectedTitle = 'RestaurantInvoices_2014_1006_1012';
    equal(title, expectedTitle, 'Creates correct invoice title for 2-digit month w/ 1-digit day');
  });
  test('get invoice tittle (M/DD)', function(){
    var title = getInvoiceTitle(dates.mdd),
      expectedTitle = 'RestaurantInvoices_2014_0512_0518';
    equal(title, expectedTitle, 'Creates correct invoice title for 1-digit month w/ 2-digit day');
  });
  test('get invoice tittle (MM/DD)', function(){
    var title = getInvoiceTitle(dates.mmdd),
      expectedTitle = 'RestaurantInvoices_2014_1013_1019';
    equal(title, expectedTitle, 'Creates correct invoice title for 2-digit month w/ 2-digit day');
  });
};

function testInvoiceMethods(){
  
  var fakeNow = new Date(2014, 04, 12); // monday 5/12/2014
  Logger.log('fakeNow: ' + fakeNow);
  var lastMon = fakeNow.incrementDate(-7),
    lastWeek = lastMon.getWeekMap(),
    invoicesSheet = new Sheet('1WvCl00TYaNpCjmlfhdirUNets-fCljQclwtqw_OKQSg', 'index'),//Sheet
    p = {
      now: fakeNow, //Date
      invoicePrintoutSheet: {},//new Sheet('1bCb_k9JqaWY59uT7wuA2bNJOHneppL0s9Eg1zzwXPfA', 'index'),//Sheet
      invoicesSheet: invoicesSheet,//Sheet
      restaurantsSheet: new Sheet('0AkfgEUsp5QrAdGxSeGlFVjdDdEgxS29GUGI0Sjg0RHc', 'info'),//Sheet
      balancesSheet: new Sheet('0AkfgEUsp5QrAdGxSeGlFVjdDdEgxS29GUGI0Sjg0RHc', 'balances'),//Sheet
      invoices: new Invoices(invoicesSheet),//Invoices
      week: lastWeek,//Date.weekMap
      restaurant: {},// Restaurant
      shifts: [] // Array of Shfits
    },
    chargeScenarios = getChargeScenarios(p);
  // testInvoiceWriteToModel(chargeScenarios, p);
  // testInvoiceUpdateBalance(chargeScenarios.vanilla, p);
  testInvoicePrintSingle(chargeScenarios, p);
  testInvoicePrintMultiple(chargeScenarios, p);
};

function testInvoiceWriteToModel(chargeScenarios, p){
  Logger.log('running testInvoiceWriteToModel('+chargeScenarios+', ' +p+')');
  p.restaurant = chargeScenarios.vanilla.restaurant;
  p.shifts = chargeScenarios.vanilla.shifts;
  var oldLastRow = p.invoicesSheet.g.getLastRow(),
    invoice = new Invoice(p);

  invoice.writeToModel();
  p.invoicesSheet.refresh();
  var newLastRow = p.invoicesSheet.row.getLast();

  test('Invoice.writeToModel() appends a new row to the Invoices model', function(){
    equal(newLastRow, oldLastRow +1, 'new row appended');
  });
  _.each(chargeScenarios, function(scenario, scenarioName){
    Logger.log('testing invoice.writeToModel for scenario: ' + scenarioName);
    p.restaurant = scenario.restaurant;
    p.shifts = scenario.shifts;
    
    var invoice = new Invoice(p);
    invoice.writeToModel();
    p.invoicesSheet.refresh();

    var row = p.invoicesSheet.row.getLast(),
      col = p.invoicesSheet.getColNum('charge'),
      charge = p.invoicesSheet.getCell(row, col).toFixed(2),
      expectedCharge = scenario.expectedCharge;

    test('Invoice.writeToModel() creates correct charges for scenario: ' + scenarioName, function(){
      equal(charge, expectedCharge, 'correct chrage for ' + scenarioName);
    });
  });
};

function testInvoiceUpdateBalance(scenario, p){
  p.restaurant = scenario.restaurant;
  p.shifts = scenario.shifts;
  var invoice = new Invoice(p),
    oldCharges = invoice.balance.charges;
  Logger.log('invoice: ' +invoice);
  Logger.log('invoice.balance: ' +invoice.balance);
  Logger.log('invoice.balance.charges: ' +invoice.balance.charges);
  invoice
    .updateBalance();
  Logger.log('invoice.balance.charges: ' +invoice.balance.charges);
    

  test('Invoice.updateBalance() updates charges value correctly', function(){
    var newCharges = invoice.balance.charges,
      expectedCharges = oldCharges + invoice.charges.charge;
    Logger.log('expectedCharges: ' + expectedCharges);
    Logger.log('newCharges: ' + newCharges);
    equal(newCharges, expectedCharges, 'charges updated correctly');
  });
  test('Invoice.updateBalance() updates last charge correctly', function(){
    var date = invoice.balance.lastCharge.toDateString();
    var expectedDate = invoice.dateIssued.toDateString();
    Logger.log('expectedDate' + expectedDate);
    deepEqual(date, expectedDate, 'last charge updated correctly');
  });
};

function testInvoicePrintSingle(chargeScenarios, p){
  Logger.log('running testInvoicePrintSingle()');
  p.balancesSheet = new Sheet(p.balancesSheet.id, 'staticBalances');
  p.invoicesSheet = new Sheet(p.invoicesSheet.id, 'static0rows');
  Logger.log('p.invoicesSheet.data.length: ' + p.invoicesSheet.data.length);
  Logger.log('p.balancesSheet.data[59].balance: ' + p.balancesSheet.data[59].balance);
  _.each(chargeScenarios, function(scenario, scenarioName){
    Logger.log('running loop for ' + scenarioName);

    var expectedSheet = new Sheet('1kiHg4fs7bMTJg4vAjZ1qZ8EBg1KUdmHNID-WoGrvEhk', scenarioName),
      resultsSheet = new Sheet('1bCb_k9JqaWY59uT7wuA2bNJOHneppL0s9Eg1zzwXPfA', scenarioName);
    p = loadScenarioParams(p, scenario);
    p.invoicePrintoutSheet = resultsSheet;

    Logger.log('p.invoicesSheet.data.length: ' + p.invoicesSheet.data.length);
    var invoice = new Invoice(p);
    resetTestSheet(resultsSheet);
    invoice.print();

    var expectedRange = expectedSheet.g.getRange(1,1, expectedSheet.g.getLastRow(), expectedSheet.g.getLastColumn()).getValues(),
      resultsRange = resultsSheet.g.getRange(1,1, resultsSheet.g.getLastRow(), resultsSheet.g.getLastColumn()).getValues();

    test(scenarioName + ' prints correctly:', function(){
      deepEqual(resultsRange, expectedRange);
    });

  });
};



function testInvoicePrintMultiple(chargeScenarios, p){

  var expectedSheet = new Sheet('1kiHg4fs7bMTJg4vAjZ1qZ8EBg1KUdmHNID-WoGrvEhk', 'twoRestos'),
    resultsSheet = new Sheet('1bCb_k9JqaWY59uT7wuA2bNJOHneppL0s9Eg1zzwXPfA', 'twoRestos');
  resetTestSheet(resultsSheet);
  
  p.invoicePrintoutSheet = resultsSheet;
  p = loadScenarioParams(p, chargeScenarios.vanilla);
  p.balancesSheet = new Sheet(p.balancesSheet.id, 'staticBalances');
  p.invoicesSheet = new Sheet(p.invoicesSheet.id, 'static0rows');

  vanillaInvoice = new Invoice(p);
  Logger.log('printing vanilla invoice');
  vanillaInvoice.print();

  p.invoicePrintoutSheet.refresh();
  p.invoicesSheet = new Sheet(p.invoicesSheet.id, 'static1row');

  p = loadScenarioParams(p, chargeScenarios.tax);
  taxInvoice = new Invoice(p);
  Logger.log('printing tax invoice');
  taxInvoice.print();
  p.invoicePrintoutSheet.refresh();

  
  var expectedRange = expectedSheet.g.getRange(1,1, expectedSheet.g.getLastRow(), expectedSheet.g.getLastColumn()).getValues(),
    resultsRange = resultsSheet.g.getRange(1,1, resultsSheet.g.getLastRow(), resultsSheet.g.getLastColumn()).getValues();

  test('Multiple invoices print correctly', function(){
    deepEqual(resultsRange, expectedRange, 'passes!');
  });

};


function testPaymentUpdateBalance(payment){
  payment
    .updateBalance()
    .refreshBalancesSheet();
  test('Payment.updateBalance() updates payments value correctly', function(){
    var payments = payment.balance.payments.toFixed(2),
      expectedPayments = (payments - payment.amount).toFixed(2);
    equal(payments, expectedPayments, 'payments updated correctly');
  });
  test('Payment.updateBalance() updates last payment correctly', function(){
    var date = payment.balance.lastPayment.toDateString(),
      expectedDate = payment.dateProcessed.toDateString();
    Logger.log('expectedDate' + expectedDate);
    equal(date, expectedDate, 'last payment updated correctly');
  });
};

function resetTestSheet(sheet){
  sheet.g.getRange(2,1, sheet.g.getLastRow()-1, 7).clear();
};

function loadScenarioParams(p, scenario){
  p.restaurant = scenario.restaurant;
  p.shifts = scenario.shifts;
  return p;
};

function getChargeScenarios(p){
  var mileEndBkk = p.restaurantsSheet.data[61],
    mileEndManhattt = p.restaurantsSheet.data[59],
    start = new Date(p.week.mon.getFullYear(), p.week.mon.getMonth(), p.week.mon.getDate(), 11),
    end = new Date(p.week.mon.getFullYear(), p.week.mon.getMonth(), p.week.mon.getDate(), 17);
  return {
    vanilla: {
      restaurant: mileEndBkk,
      shifts: [{
        id: 0,
        riderid: 0,
        start: start,
        end: end,  
        status: 'confirmed',   
        billing: 'normal' 
      }],
      expectedCharge: '10.00'
    },
    tax: {
      restaurant: mileEndManhattt,
      shifts: [{
          id: 0,
          riderid: 0, 
          start: start,
          end: end, 
          status: 'confirmed',   
          billing: 'normal'
      }],
      expectedCharge: '10.89'
    },
    discount: {
      restaurant: mileEndBkk,
      shifts: getDiscountShifts(start, end),
      expectedCharge: '100.00'
    },
    extraRider: {
      restaurant: mileEndBkk,
      shifts: [{
        id: 0,
        riderid: 0, 
        start: start,
        end: end, 
        status: 'confirmed',   
        billing: 'normal'
      },{
        id: 0,
        riderid: 1,
        start: start,
        end: end,
        status: 'confirmed',
        billing: 'extra rider'
      }],
      expectedCharge: '15.00'
    },
    emergencyExtraRider: {
      restaurant: mileEndBkk,
      shifts: [{
        id: 0,
        riderid: 0, 
        start: start,
        end: end, 
        status: 'confirmed',   
        billing: 'normal'
      },{
        id: 0,
        riderid: 1,
        start: start.incrementDate(1),
        end: end.incrementDate(1),
        status: 'confirmed',
        billing: 'extra rider emergency'
      }],
      expectedCharge: '20.00'
    },
    free: {
      restaurant: mileEndBkk,
      shifts: [{
        id: 0,
        riderid: 0, 
        start: start,
        end: end, 
        status: 'confirmed',   
        billing: 'normal'
      },{
        id: 0,
        riderid: 1,
        start: start.incrementDate(1),
        end: end.incrementDate(1),
        status: 'cancelled free',
        billing: 'free'
      }],
      expectedCharge: '10.00'
    } 
  };
};

function getDiscountShifts(start, end){
  var shifts = [];
  _(11).times(function(n){
    // Logger.log('start: ' + start);
    dateNum = n < 7 ? n : n -7;
    shifts.push({
      id: n,
      riderid: n,  
      start: start.incrementDate(dateNum),
      end: end.incrementDate(dateNum),            
      status: 'confirmed',   
      billing: 'normal'
    });
  });
  return shifts;
};

function testSortByDate(view){
  var nums = [1,2,3], 
    startDates = nums.map(function (a) {return createStart(a, 'date');}),
    endDates = nums.map(function (a) {return createEnd(a, 'date');}), 
    startHours = nums.map(function (a) {return createStart(a, 'hour');}),
    endHours = nums.map(function (a) {return createEnd(a, 'hour');});

  Logger.log('startDates: ' + startDates);

  var descDates = getRecs(startDates, endDates, 'descending'),
    ascDates = getRecs(startDates, endDates, 'ascending'),
    ascHours = getRecs(startHours, endHours, 'ascending'),
    descHours = getRecs(startHours, endHours, 'descending');
  
  test('sort dates from descending to ascending', function(){
    deepEqual(sortByDate(descDates), ascDates, 'Dates in descending order sorted to ascending order.');
  });

  test('sort same day but different hours from descending to ascending', function(){
    deepEqual(sortByDate(descHours), ascHours, 'Hours in descending order sorted to ascending order.')
  });
  
  // function createStartDate(num){
  //   createStart(num, 'date');
  // };

  function createStart(num, mod){
    Logger.log('running createStart('+num+', '+mod+')');
    var ret = mod === 'date' ? new Date(2014, 1, num, 1) : new Date(2014, 1, 1, num);
    Logger.log('ret: ' + ret);
    return ret;
  };

  function createEnd(num, mod){
    return mod === 'date' ? new Date(2014, 1, num, 2) : new Date(2014, 1, 1, num);
  };

  function getRecs(starts, ends, sort){
    var recs = [];
    if (sort === 'ascending'){
      for (var i = 0; i < starts.length; i++) {
        createRec(starts[i], ends[i], recs);
      };
    } else if (sort === 'descending'){
      for (var i = starts.length - 1; i >= 0; i--) {
        createRec(starts[i], ends[i], recs);
      };
    }
    return recs;

    function createRec(start, end, recs){
      recs.push({
        id: 0,
        start: start,
        end: end,
        restaurantid: 4,
        riderid: 1
      });
    };
  };
};



//** FUNCTIONS UNDER TEST **//

function sortByDate (recs){
  recs.sort(function(a,b){
    if (a.start.getTime() < b.start.getTime()){return -1;}
    if (a.start.getTime() > b.start.getTime()){return 1;}
  });
  return recs;
};
