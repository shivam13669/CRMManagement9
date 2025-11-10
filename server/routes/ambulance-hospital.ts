import { RequestHandler } from "express";
import { db } from "../database";

// Forward ambulance request to hospital
export const handleForwardAmbulanceToHospital: RequestHandler = async (
  req,
  res,
) => {
  try {
    const { userId, role } = (req as any).user;
    const { requestId, hospitalId } = req.body;

    if (role !== "admin") {
      return res.status(403).json({
        error: "Only admins can forward ambulance requests to hospitals",
      });
    }

    if (!requestId || !hospitalId) {
      return res
        .status(400)
        .json({ error: "Missing required fields: requestId, hospitalId" });
    }

    // Get ambulance request details
    const ambulanceResult = db.exec(
      `SELECT ar.*, u.full_name as patient_name, u.email as patient_email
       FROM ambulance_requests ar
       JOIN users u ON ar.customer_user_id = u.id
       WHERE ar.id = ?`,
      [requestId],
    );

    if (
      !ambulanceResult ||
      ambulanceResult.length === 0 ||
      ambulanceResult[0].values.length === 0
    ) {
      return res.status(404).json({ error: "Ambulance request not found" });
    }

    const columns = ambulanceResult[0].columns;
    const row = ambulanceResult[0].values[0];
    const ambulanceRequest: any = {};
    columns.forEach((col, index) => {
      ambulanceRequest[col] = row[index];
    });

    // Get hospital details
    const hospitalResult = db.exec(
      `SELECT u.id, u.full_name, h.hospital_name, h.phone_number
       FROM users u
       JOIN hospitals h ON u.id = h.user_id
       WHERE u.id = ? AND u.role = 'hospital'`,
      [hospitalId],
    );

    if (
      !hospitalResult ||
      hospitalResult.length === 0 ||
      hospitalResult[0].values.length === 0
    ) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    const hospitalColumns = hospitalResult[0].columns;
    const hospitalRow = hospitalResult[0].values[0];
    const hospital: any = {};
    hospitalColumns.forEach((col, index) => {
      hospital[col] = hospitalRow[index];
    });

    // Create hospital service request
    db.run(
      `INSERT INTO hospital_service_requests (
        hospital_user_id, customer_user_id, admin_user_id, ambulance_request_id,
        service_type, description, status, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        hospitalId,
        ambulanceRequest.customer_user_id,
        userId,
        requestId,
        "Ambulance Request",
        `Emergency ambulance request - ${ambulanceRequest.emergency_type}`,
        "pending",
        ambulanceRequest.priority,
      ],
    );

    const hsrResult = db.exec("SELECT last_insert_rowid() as id");
    const hsrId = hsrResult[0].values[0][0];

    // Update ambulance request to mark as forwarded
    db.run(
      `UPDATE ambulance_requests
       SET status = 'forwarded_to_hospital', forwarded_to_hospital_id = ?, hospital_request_id = ?, is_read = 1, updated_at = datetime('now')
       WHERE id = ?`,
      [hospitalId, hsrId, requestId],
    );

    // Create notifications
    const adminNotifMessage = `Ambulance request #${requestId} forwarded to ${hospital.hospital_name}`;
    const customerNotifMessage = `Your ambulance request has been forwarded to ${hospital.hospital_name}. Awaiting response.`;
    const hospitalNotifMessage = `New ambulance service request from admin: ${ambulanceRequest.emergency_type}`;

    // Store notifications (assuming notifications table or API)
    // This will be handled by the notification system

    console.log(
      `✅ Ambulance request ${requestId} forwarded to hospital ${hospitalId}`,
    );

    res.status(201).json({
      message: "Ambulance request forwarded to hospital successfully",
      serviceRequestId: hsrId,
      hospital: {
        id: hospital.id,
        name: hospital.hospital_name,
        phone: hospital.phone_number,
      },
    });
  } catch (error) {
    console.error("Forward ambulance to hospital error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get hospital service requests for hospital
export const handleGetHospitalServiceRequests: RequestHandler = async (
  req,
  res,
) => {
  try {
    const { userId, role } = (req as any).user;

    if (role !== "hospital") {
      return res.status(403).json({
        error: "Only hospitals can view service requests",
      });
    }

    const result = db.exec(
      `SELECT
        hsr.id,
        hsr.hospital_user_id,
        hsr.customer_user_id,
        hsr.admin_user_id,
        hsr.ambulance_request_id,
        hsr.service_type,
        hsr.description,
        hsr.status,
        hsr.priority,
        hsr.hospital_response,
        hsr.hospital_response_at,
        hsr.notes,
        hsr.created_at,
        hsr.updated_at,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        admin.full_name as admin_name,
        admin.email as admin_email,
        ar.pickup_address,
        ar.emergency_type,
        ar.priority as request_priority
      FROM hospital_service_requests hsr
      LEFT JOIN users u ON hsr.customer_user_id = u.id
      LEFT JOIN users admin ON hsr.admin_user_id = admin.id
      LEFT JOIN ambulance_requests ar ON hsr.ambulance_request_id = ar.id
      WHERE hsr.hospital_user_id = ?
      ORDER BY hsr.created_at DESC`,
      [userId],
    );

    let requests = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      const rows = result[0].values;

      requests = rows.map((row) => {
        const request: any = {};
        columns.forEach((col, index) => {
          request[col] = row[index];
        });
        return request;
      });
    }

    res.json({
      requests,
      total: requests.length,
    });
  } catch (error) {
    console.error("Get hospital service requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Hospital accept service request
export const handleHospitalAcceptRequest: RequestHandler = async (
  req,
  res,
) => {
  try {
    const { userId, role } = (req as any).user;
    const { serviceRequestId } = req.params;
    const { notes } = req.body;

    if (role !== "hospital") {
      return res.status(403).json({
        error: "Only hospitals can accept service requests",
      });
    }

    // Verify the request belongs to this hospital
    const result = db.exec(
      `SELECT hospital_user_id, ambulance_request_id FROM hospital_service_requests WHERE id = ?`,
      [serviceRequestId],
    );

    if (!result || result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const row = result[0].values[0];
    const hospitalUserId = row[0];
    const ambulanceRequestId = row[1];

    if (hospitalUserId !== userId) {
      return res.status(403).json({
        error: "You cannot accept requests for other hospitals",
      });
    }

    // Update service request status
    db.run(
      `UPDATE hospital_service_requests
       SET status = 'accepted', hospital_response = 'ACCEPTED', hospital_response_at = datetime('now'), notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [notes || null, serviceRequestId],
    );

    // Update ambulance request status
    if (ambulanceRequestId) {
      db.run(
        `UPDATE ambulance_requests
         SET status = 'assigned', updated_at = datetime('now')
         WHERE id = ?`,
        [ambulanceRequestId],
      );
    }

    console.log(
      `✅ Hospital ${userId} accepted service request ${serviceRequestId}`,
    );

    res.json({
      message: "Service request accepted successfully",
    });
  } catch (error) {
    console.error("Hospital accept request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Hospital reject service request
export const handleHospitalRejectRequest: RequestHandler = async (
  req,
  res,
) => {
  try {
    const { userId, role } = (req as any).user;
    const { serviceRequestId } = req.params;
    const { notes } = req.body;

    if (role !== "hospital") {
      return res.status(403).json({
        error: "Only hospitals can reject service requests",
      });
    }

    // Verify the request belongs to this hospital
    const result = db.exec(
      `SELECT hospital_user_id FROM hospital_service_requests WHERE id = ?`,
      [serviceRequestId],
    );

    if (!result || result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const hospitalUserId = result[0].values[0][0];

    if (hospitalUserId !== userId) {
      return res.status(403).json({
        error: "You cannot reject requests for other hospitals",
      });
    }

    // Update service request status
    db.run(
      `UPDATE hospital_service_requests
       SET status = 'rejected', hospital_response = 'REJECTED', hospital_response_at = datetime('now'), notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [notes || null, serviceRequestId],
    );

    console.log(
      `✅ Hospital ${userId} rejected service request ${serviceRequestId}`,
    );

    res.json({
      message: "Service request rejected successfully",
    });
  } catch (error) {
    console.error("Hospital reject request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get hospitals by state (for admin forwarding)
export const handleGetHospitalsByState: RequestHandler = async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role !== "admin") {
      return res.status(403).json({
        error: "Only admins can view hospitals",
      });
    }

    // Get admin's state and district
    const adminMetaResult = db.exec(
      `SELECT state, district FROM admin_metadata WHERE user_id = ?`,
      [userId],
    );

    let adminState = null;
    let adminDistrict = null;

    if (
      adminMetaResult &&
      adminMetaResult.length > 0 &&
      adminMetaResult[0].values.length > 0
    ) {
      const row = adminMetaResult[0].values[0];
      adminState = row[0];
      adminDistrict = row[1];
    }

    // Check if admin is system admin (has no state/district restriction)
    const isSystemAdmin = !adminState;

    let query = `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        h.hospital_name,
        h.address,
        h.state,
        h.district,
        h.hospital_type,
        h.number_of_ambulances,
        h.phone_number
      FROM users u
      JOIN hospitals h ON u.id = h.user_id
      WHERE u.role = 'hospital' AND u.status = 'active'
    `;

    let params: any[] = [];

    // If not system admin, filter by state
    if (!isSystemAdmin) {
      query += ` AND h.state = ?`;
      params = [adminState];
    }

    query += ` ORDER BY h.hospital_name`;

    const result = db.exec(query, params);

    let hospitals = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      const rows = result[0].values;

      hospitals = rows.map((row) => {
        const hospital: any = {};
        columns.forEach((col, index) => {
          hospital[col] = row[index];
        });
        return hospital;
      });
    }

    res.json({
      hospitals,
      total: hospitals.length,
      adminState,
      adminDistrict,
      isSystemAdmin,
    });
  } catch (error) {
    console.error("Get hospitals by state error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
