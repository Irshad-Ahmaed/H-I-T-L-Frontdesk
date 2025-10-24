// This is our simple text message simulator
class NotificationService {
  static sendSupervisorAlert(question, customerPhone) {
    const alertMessage = `
    ==================================================
    [SUPERVISOR ALERT]
    New help request from: ${customerPhone}
    Question: "${question}"
    Please log in to the admin panel to respond.
    ==================================================
    `;
    console.warn(alertMessage);
  }

  static sendCustomerText(customerPhone, question, answer) {
    const textMessage = `
    ==================================================
    [CUSTOMER TEXT]
    To: ${customerPhone}
    Message: Hi! Here's the answer to your recent question:
    "${question}"
    Answer:"${answer}"
    ================================
    `;
    console.log(textMessage);
  }
}

export default NotificationService;