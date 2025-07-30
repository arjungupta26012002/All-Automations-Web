function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Automations Dashboard')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME_MODE); 
}



function getDashboardData() {
  const spreadsheetId = 'MasterSheetID'; 
  const ss = SpreadsheetApp.openById(spreadsheetId);

  
  const logsSheet = ss.getSheetByName('logs');
  let totalInternsMarked = 0;
  if (logsSheet) {
    const headers = logsSheet.getRange(1, 1, 1, logsSheet.getLastColumn()).getValues()[0];
    const totalColumnIndex = headers.indexOf('Total');
    if (totalColumnIndex !== -1) {
      
      totalInternsMarked = logsSheet.getRange(2, totalColumnIndex + 1).getValue();
    }
  }

  const mailLogsSheet = ss.getSheetByName('MailLogs');
  let totalMailsSent = 0;
  if (mailLogsSheet) {
    const headers = mailLogsSheet.getRange(1, 1, 1, mailLogsSheet.getLastColumn()).getValues()[0];
    const totalMailsColumnIndex = headers.indexOf('Total Mails Sent');
    if (totalMailsColumnIndex !== -1) {
     
      totalMailsSent = mailLogsSheet.getRange(2, totalMailsColumnIndex + 1).getValue();
    }
  }


  const userEmails = new Set();

  if (logsSheet) {
    const headers = logsSheet.getRange(1, 1, 1, logsSheet.getLastColumn()).getValues()[0];
    const userEmailColumnIndex = headers.indexOf('User Email');
    if (userEmailColumnIndex !== -1) {
      const data = logsSheet.getRange(2, userEmailColumnIndex + 1, logsSheet.getLastRow() - 1, 1).getValues();
      data.forEach(row => {
        const email = String(row[0]).trim();
        if (email) {
          const username = email.split('@')[0];
          if (username) userEmails.add(username);
        }
      });
    }
  }

  if (mailLogsSheet) {
    const headers = mailLogsSheet.getRange(1, 1, 1, mailLogsSheet.getLastColumn()).getValues()[0];
    const userEmailColumnIndex = headers.indexOf('User Email');
    if (userEmailColumnIndex !== -1) {
      const data = mailLogsSheet.getRange(2, userEmailColumnIndex + 1, mailLogsSheet.getLastRow() - 1, 1).getValues();
      data.forEach(row => {
        const email = String(row[0]).trim();
        if (email) {
          const username = email.split('@')[0];
          if (username) userEmails.add(username);
        }
      });
    }
  }

  const uniqueUsersCount = userEmails.size;
  const uniqueUserNamesList = Array.from(userEmails).sort(); 
  return {
    totalInternsMarked: totalInternsMarked,
    totalMailsSent: totalMailsSent,
    uniqueUsersCount: uniqueUsersCount,
    uniqueUserNamesList: uniqueUserNamesList 
  };
}
