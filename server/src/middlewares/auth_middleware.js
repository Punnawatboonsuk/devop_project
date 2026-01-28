export function loginRequired(req, res, next) {
  if (!req.session.user_id) {
    if (req.is("application/json")) {
      return res.status(401).json({ message: "Authentication required" });
    }
    return res.redirect("/login");
  }
  next();
}

export function roleRequired(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
}

function roleOnly(role) {
  return (req, res, next) => {
    if (!req.session.user_id || req.session.role !== role) {
      return res.status(403).json({ message: `Access denied. ${role} only.` });
    }
    next();
  };
}

export const studentOnly = roleOnly("STUDENT");
export const staffOnly = roleOnly("STAFF");
export const subdeanOnly = roleOnly("SUB_DEAN");
export const deanOnly = roleOnly("DEAN");
export const adminOnly = roleOnly("ADMIN");

export const committeeOnly = (req, res, next) => {
  const role = req.session.role;
  if (!req.session.user_id || !["COMMITTEE", "COMMITTEE_PRESIDENT"].includes(role)) {
    return res.status(403).json({ message: "Access denied. Committee only." });
  }
  next();
};

export const PERMISSIONS = {
  create_ticket: ["STUDENT"],
  view_own_tickets: ["STUDENT"],
  view_department_tickets: ["STAFF"],
  approve_ticket_level1: ["STAFF"],
  approve_ticket_level2: ["SUB_DEAN"],
  approve_ticket_level3: ["DEAN"],
  view_all_tickets: ["ADMIN", "COMMITTEE", "COMMITTEE_PRESIDENT"],
  edit_ticket_type: ["ADMIN"],
  override_status: ["ADMIN"],
  open_close_voting: ["ADMIN"],
  vote_ticket: ["COMMITTEE", "COMMITTEE_PRESIDENT"],
  sign_ticket: ["COMMITTEE_PRESIDENT"],
  export_winners: ["ADMIN"],
};

export function hasPermission(action) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const allowed = PERMISSIONS[action] || [];
    if (!allowed.includes(req.session.role)) {
      return res.status(403).json({
        message: `Access denied. Action '${action}' requires one of: ${allowed.join(", ")}`,
      });
    }
    next();
  };
}
