const COUNTER_SHEET_ID = 'SheetID'; 

const SECRET_OFFSET = xxx-changable-xxx; 
const ENCRYPT_PREFIX = 'X!--!X'; 

function encryptValue(num) {
  if (typeof num !== 'number' || isNaN(num) || num === null) {
    num = 0; 
  }
  const processedNum = Math.round(num) + SECRET_OFFSET;
  return ENCRYPT_PREFIX + processedNum.toString(36);
}

function decryptValue(str) {
  if (typeof str !== 'string' || !str.startsWith(ENCRYPT_PREFIX)) {

    return 0;
  }
  const strippedStr = str.substring(ENCRYPT_PREFIX.length);
  const parsedValue = parseInt(strippedStr, 36); 

  if (isNaN(parsedValue)) {
    return 0; 
  }

  const decryptedNum = parsedValue - SECRET_OFFSET;
  return Math.max(0, decryptedNum); 
}

function ensureCounterSheetColumns() {
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  let counterSheet = ss.getSheetByName('Counter');

  if (!counterSheet) {
    counterSheet = ss.insertSheet('Counter');
  }

  const headers = counterSheet.getRange(1, 1, 1, counterSheet.getLastColumn()).getValues()[0];
  const requiredHeaders = ['Email ID', 'Name', 'Past Month Leaderboard', 'Current Month Leaderboard', 'Current Week Leaderboard', 'Last Daily Reset Date', 'Daily Count', 'Lifetime Count'];

  let missingHeaders = false;
  for (let i = 0; i < requiredHeaders.length; i++) {
    if (headers.indexOf(requiredHeaders[i]) === -1) {
      missingHeaders = true;
      break;
    }
  }

  if (missingHeaders || headers.length === 0) {
    counterSheet.clearContents();
    counterSheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    counterSheet.setFrozenRows(1);
  }
}

function getUserEmail() {
  const userEmail = Session.getActiveUser().getEmail();
  if (!userEmail) {
    throw new Error("Could not retrieve user email. Ensure proper deployment permissions.");
  }
  return userEmail;
}

function registerUser(name) {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');
  const userEmail = getUserEmail();

  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(2, 1, lastRow > 1 ? lastRow - 1 : 1, sheet.getLastColumn());
  const values = range.getValues();

  let userFound = false;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === userEmail) {
      userFound = true;
      break;
    }
  }

  if (!userFound) {

    sheet.appendRow([
      userEmail,
      name,
      encryptValue(0), 
      encryptValue(0), 
      encryptValue(0), 
      '', 
      encryptValue(0), 
      encryptValue(0)  
    ]);
  }
}

function isUserRegistered() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');
  const userEmail = getUserEmail();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { registered: false, name: '' };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailColIndex = headers.indexOf('Email ID');
  const nameColIndex = headers.indexOf('Name');

  if (emailColIndex === -1 || nameColIndex === -1) {
    throw new Error('Required columns (Email ID, Name) not found in Counter sheet.');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailColIndex] === userEmail) {
      return { registered: true, name: data[i][nameColIndex] };
    }
  }
  return { registered: false, name: '' };
}

function getCounterValue() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');
  const userEmail = getUserEmail();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailColIndex = headers.indexOf('Email ID');
  const pastMonthColIndex = headers.indexOf('Past Month Leaderboard');
  const currentMonthColIndex = headers.indexOf('Current Month Leaderboard');
  const currentWeekColIndex = headers.indexOf('Current Week Leaderboard');
  const lastDailyResetDateColIndex = headers.indexOf('Last Daily Reset Date');
  const dailyCountColIndex = headers.indexOf('Daily Count');
  const lifetimeColIndex = headers.indexOf('Lifetime Count');

  if ([emailColIndex, pastMonthColIndex, currentMonthColIndex, currentWeekColIndex, lastDailyResetDateColIndex, dailyCountColIndex, lifetimeColIndex].includes(-1)) {
    throw new Error('One or more required columns missing in Counter sheet for counter logic.');
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  let userRowIndex = -1;
  let userRow = null;

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailColIndex] === userEmail) {
      userRowIndex = i + 2;
      userRow = data[i];
      break;
    }
  }

  if (userRow === null) {
    throw new Error("User not found or not registered. Please register first.");
  }

  let currentMonthCount = decryptValue(userRow[currentMonthColIndex]);
  let currentWeekCount = decryptValue(userRow[currentWeekColIndex]);
  let dailyCount = decryptValue(userRow[dailyCountColIndex]);
  let lastDailyResetDate = userRow[lastDailyResetDateColIndex] ? new Date(userRow[lastDailyResetDateColIndex]) : null;
  let pastMonthCount = decryptValue(userRow[pastMonthColIndex]);
  let lifetimeCount = decryptValue(userRow[lifetimeColIndex]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!lastDailyResetDate || lastDailyResetDate.toDateString() !== today.toDateString()) {
    dailyCount = 0; 
    sheet.getRange(userRowIndex, dailyCountColIndex + 1).setValue(encryptValue(0)); 
    sheet.getRange(userRowIndex, lastDailyResetDateColIndex + 1).setValue(today);
  }

  return {
    currentCount: dailyCount, 
    currentMonthLeaderboard: currentMonthCount,
    currentWeekLeaderboard: currentWeekCount,
    pastMonthLeaderboard: pastMonthCount,
    lifetimeCount: lifetimeCount
  };
}

function incrementCounter() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');
  const userEmail = getUserEmail();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailColIndex = headers.indexOf('Email ID');
  const nameColIndex = headers.indexOf('Name');
  const pastMonthColIndex = headers.indexOf('Past Month Leaderboard');
  const currentMonthColIndex = headers.indexOf('Current Month Leaderboard');
  const currentWeekColIndex = headers.indexOf('Current Week Leaderboard');
  const lastDailyResetDateColIndex = headers.indexOf('Last Daily Reset Date');
  const dailyCountColIndex = headers.indexOf('Daily Count');
  const lifetimeColIndex = headers.indexOf('Lifetime Count');

  if ([emailColIndex, nameColIndex, pastMonthColIndex, currentMonthColIndex, currentWeekColIndex, lastDailyResetDateColIndex, dailyCountColIndex, lifetimeColIndex].includes(-1)) {
    throw new Error('One or more required columns missing in Counter sheet for incrementing.');
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  let userRowIndex = -1;
  let userRow = null;

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailColIndex] === userEmail) {
      userRowIndex = i + 2;
      userRow = data[i];
      break;
    }
  }

  if (userRow === null) {
    throw new Error("User not found or not registered. Please register first.");
  }

  let currentDailyCount = decryptValue(userRow[dailyCountColIndex]);
  let currentMonthCount = decryptValue(userRow[currentMonthColIndex]);
  let currentWeekCount = decryptValue(userRow[currentWeekColIndex]);
  let lifetimeCount = decryptValue(userRow[lifetimeColIndex]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let lastDailyResetDate = userRow[lastDailyResetDateColIndex] ? new Date(userRow[lastDailyResetDateColIndex]) : null;

  if (!lastDailyResetDate || lastDailyResetDate.toDateString() !== today.toDateString()) {
    currentDailyCount = 1;
    sheet.getRange(userRowIndex, lastDailyResetDateColIndex + 1).setValue(today);
  } else {
    currentDailyCount++;
  }

  currentMonthCount++;
  currentWeekCount++;
  lifetimeCount++;

  sheet.getRange(userRowIndex, dailyCountColIndex + 1).setValue(encryptValue(currentDailyCount));
  sheet.getRange(userRowIndex, currentMonthColIndex + 1).setValue(encryptValue(currentMonthCount));
  sheet.getRange(userRowIndex, currentWeekColIndex + 1).setValue(encryptValue(currentWeekCount));
  sheet.getRange(userRowIndex, lifetimeColIndex + 1).setValue(encryptValue(lifetimeCount));

  return currentDailyCount;
}

function getLeaderboardData() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { dailyLeaderboard: [], monthlyLeaderboard: [], pastMonthLeaderboard: [], lifetimeLeaderboard: [] };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const nameColIndex = headers.indexOf('Name');
  const currentWeekColIndex = headers.indexOf('Current Week Leaderboard');
  const currentMonthColIndex = headers.indexOf('Current Month Leaderboard');
  const pastMonthColIndex = headers.indexOf('Past Month Leaderboard');
  const lifetimeColIndex = headers.indexOf('Lifetime Count');

  if ([nameColIndex, currentWeekColIndex, currentMonthColIndex, pastMonthColIndex, lifetimeColIndex].includes(-1)) {
    throw new Error('Required columns for leaderboard (Name, Current Week Leaderboard, Current Month Leaderboard, Past Month Leaderboard, Lifetime Count) not found in Counter sheet.');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  const weeklyLeaderboard = [];
  const currentMonthlyLeaderboard = [];
  const pastMonthlyLeaderboard = [];
  const lifetimeLeaderboard = [];

  data.forEach(row => {
    const name = row[nameColIndex];

    const weeklyCount = decryptValue(row[currentWeekColIndex]);
    const monthlyCount = decryptValue(row[currentMonthColIndex]);
    const pastMonthCount = decryptValue(row[pastMonthColIndex]);
    const lifetimeCount = decryptValue(row[lifetimeColIndex]);

    if (name) {
      weeklyLeaderboard.push({ name: name, count: weeklyCount });
      currentMonthlyLeaderboard.push({ name: name, count: monthlyCount });
      pastMonthlyLeaderboard.push({ name: name, count: pastMonthCount });
      lifetimeLeaderboard.push({ name: name, count: lifetimeCount });
    }
  });

  weeklyLeaderboard.sort((a, b) => b.count - a.count);
  currentMonthlyLeaderboard.sort((a, b) => b.count - a.count);
  pastMonthlyLeaderboard.sort((a, b) => b.count - a.count);
  lifetimeLeaderboard.sort((a, b) => b.count - a.count);

  return {
    dailyLeaderboard: weeklyLeaderboard,
    monthlyLeaderboard: currentMonthlyLeaderboard,
    pastMonthLeaderboard: pastMonthlyLeaderboard,
    lifetimeLeaderboard: lifetimeLeaderboard
  };
}

function resetDailyCounts() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dailyCountColIndex = headers.indexOf('Daily Count');
  const lastDailyResetDateColIndex = headers.indexOf('Last Daily Reset Date');

  if (dailyCountColIndex === -1 || lastDailyResetDateColIndex === -1) {
    Logger.log('resetDailyCounts: Required columns (Daily Count, Last Daily Reset Date) not found. Skipping reset.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('resetDailyCounts: No data rows to reset.');
    return;
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = dataRange.getValues();
  const today = new Date();
  const resetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const updatedValues = values.map(row => {
    row[dailyCountColIndex] = encryptValue(0); 
    row[lastDailyResetDateColIndex] = resetDate;
    return row;
  });

  dataRange.setValues(updatedValues);
  Logger.log('Daily counts reset for all users.');
}

function resetWeeklyLeaderboards() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentWeekColIndex = headers.indexOf('Current Week Leaderboard');

  if (currentWeekColIndex === -1) {
    Logger.log('resetWeeklyLeaderboards: Required column (Current Week Leaderboard) not found. Skipping reset.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('resetWeeklyLeaderboards: No data rows to reset.');
    return;
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = dataRange.getValues();

  const updatedValues = values.map(row => {
    row[currentWeekColIndex] = encryptValue(0); 
    return row;
  });

  dataRange.setValues(updatedValues);
  Logger.log('Weekly leaderboards reset for all users.');
}

function resetMonthlyLeaderboards() {
  ensureCounterSheetColumns();
  const ss = SpreadsheetApp.openById(COUNTER_SHEET_ID);
  const sheet = ss.getSheetByName('Counter');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const pastMonthColIndex = headers.indexOf('Past Month Leaderboard');
  const currentMonthColIndex = headers.indexOf('Current Month Leaderboard');

  if (pastMonthColIndex === -1 || currentMonthColIndex === -1) {
    Logger.log('resetMonthlyLeaderboards: Required columns (Past Month Leaderboard, Current Month Leaderboard) not found. Skipping reset.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('resetMonthlyLeaderboards: No data rows to reset.');
    return;
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = dataRange.getValues();

  const updatedValues = values.map(row => {
    const currentMonthValueDecrypted = decryptValue(row[currentMonthColIndex]); 
    row[pastMonthColIndex] = encryptValue(currentMonthValueDecrypted); 
    row[currentMonthColIndex] = encryptValue(0); 
    return row;
  });

  dataRange.setValues(updatedValues);
  Logger.log('Monthly leaderboards reset and past month values updated for all users.');
}
