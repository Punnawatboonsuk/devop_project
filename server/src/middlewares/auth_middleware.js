export function loginRequired(req, res, next) {
  if (!req.session.user_id) {
    if (req.is("application/json")) {
      return res.status(401).json({ message: "Authentication required" });
    }
    return res.redirect("/login");
  }
  next();
}

/**
 * Check if user has ANY of the allowed roles
 * User can have multiple roles via user_roles table
 */
export function roleRequired(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRoles = req.session.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
        required_roles: allowedRoles,
        your_roles: userRoles,
      });
    }
    next();
  };
}

/**
 * Check if user has ONLY the specified role (strict check)
 */
function roleOnly(role) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRoles = req.session.roles || [];
    
    if (!userRoles.includes(role)) {
      return res.status(403).json({ 
        message: `Access denied. ${role} role required.`,
        your_roles: userRoles,
      });
    }
    next();
  };
}

// Role-specific middleware
export const studentOnly = roleOnly("STUDENT");
export const staffOnly = roleOnly("STAFF");
export const subdeanOnly = roleOnly("SUB_DEAN");
export const deanOnly = roleOnly("DEAN");
export const adminOnly = roleOnly("ADMIN");

/**
 * Committee members (both COMMITTEE and COMMITTEE_PRESIDENT)
 */
export const committeeOnly = (req, res, next) => {
  if (!req.session.user_id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const userRoles = req.session.roles || [];
  const isCommittee = userRoles.includes("COMMITTEE") || userRoles.includes("COMMITTEE_PRESIDENT");

  if (!isCommittee) {
    return res.status(403).json({ 
      message: "Access denied. Committee member role required.",
      your_roles: userRoles,
    });
  }
  next();
};

/**
 * Committee President only
 */
export const committeePresidentOnly = roleOnly("COMMITTEE_PRESIDENT");

/**
 * Permission definitions based on roles
 * Each permission maps to allowed roles
 */
export const PERMISSIONS = {
  // Student permissions
  create_ticket: ["STUDENT"],
  view_own_tickets: ["STUDENT"],
  edit_own_ticket: ["STUDENT"],
  
  // Staff permissions
  view_department_tickets: ["STAFF", "SUB_DEAN", "DEAN", "ADMIN"],
  approve_ticket_level1: ["STAFF"],
  
  // Sub-Dean permissions
  approve_ticket_level2: ["SUB_DEAN"],
  
  // Dean permissions
  approve_ticket_level3: ["DEAN"],
  
  // Committee permissions
  view_all_tickets: ["ADMIN", "COMMITTEE", "COMMITTEE_PRESIDENT"],
  vote_ticket: ["COMMITTEE", "COMMITTEE_PRESIDENT"],
  view_votes: ["COMMITTEE", "COMMITTEE_PRESIDENT", "ADMIN"],
  
  // Committee President specific
  sign_ticket: ["COMMITTEE_PRESIDENT"],
  finalize_voting: ["COMMITTEE_PRESIDENT"],
  
  // Admin permissions
  edit_ticket_type: ["ADMIN"],
  override_status: ["ADMIN"],
  manage_users: ["ADMIN"],
  assign_roles: ["ADMIN"],
  open_close_voting: ["ADMIN"],
  manage_voting_sessions: ["ADMIN"],
  export_winners: ["ADMIN"],
  view_system_logs: ["ADMIN"],
  
  // Viewing permissions
  view_ticket_logs: ["STAFF", "SUB_DEAN", "DEAN", "ADMIN"],
  view_ticket_files: ["STUDENT", "STAFF", "SUB_DEAN", "DEAN", "COMMITTEE", "COMMITTEE_PRESIDENT", "ADMIN"],
};

/**
 * Check if user has permission for specific action
 * Works with multi-role system
 */
export function hasPermission(action) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const allowed = PERMISSIONS[action] || [];
    const userRoles = req.session.roles || [];
    
    // Check if user has any of the allowed roles
    const hasAccess = allowed.some(role => userRoles.includes(role));

    if (!hasAccess) {
      return res.status(403).json({
        message: `Access denied. Action '${action}' requires one of: ${allowed.join(", ")}`,
        your_roles: userRoles,
      });
    }
    next();
  };
}

/**
 * Check if user has ALL specified permissions
 */
export function hasAllPermissions(...actions) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRoles = req.session.roles || [];
    const missingPermissions = [];

    for (const action of actions) {
      const allowed = PERMISSIONS[action] || [];
      const hasAccess = allowed.some(role => userRoles.includes(role));
      
      if (!hasAccess) {
        missingPermissions.push(action);
      }
    }

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        message: "Access denied. Missing required permissions.",
        missing_permissions: missingPermissions,
        your_roles: userRoles,
      });
    }
    next();
  };
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(...actions) {
  return (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRoles = req.session.roles || [];
    
    for (const action of actions) {
      const allowed = PERMISSIONS[action] || [];
      const hasAccess = allowed.some(role => userRoles.includes(role));
      
      if (hasAccess) {
        return next();
      }
    }

    return res.status(403).json({
      message: "Access denied. None of the required permissions found.",
      required_actions: actions,
      your_roles: userRoles,
    });
  };
}

/**
 * Check if user is ticket owner
 * Must be used after loginRequired middleware
 */
export function isTicketOwner(getTicketUserId) {
  return async (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const ticketUserId = await getTicketUserId(req);
      
      if (req.session.user_id !== ticketUserId) {
        return res.status(403).json({
          message: "Access denied. You can only access your own tickets.",
        });
      }
      next();
    } catch (error) {
      return res.status(500).json({
        message: "Error checking ticket ownership",
        error: error.message,
      });
    }
  };
}

/**
 * Check if user can view ticket based on role and department
 */
export function canViewTicket(getTicketInfo) {
  return async (req, res, next) => {
    if (!req.session.user_id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const ticketInfo = await getTicketInfo(req);
      const userRoles = req.session.roles || [];

      // Admin and Committee can view all tickets
      if (userRoles.includes("ADMIN") || 
          userRoles.includes("COMMITTEE") || 
          userRoles.includes("COMMITTEE_PRESIDENT")) {
        return next();
      }

      // Ticket owner can view their own ticket
      if (ticketInfo.user_id === req.session.user_id) {
        return next();
      }

      // Staff, Sub-Dean, Dean can view tickets from their department
      if ((userRoles.includes("STAFF") || 
           userRoles.includes("SUB_DEAN") || 
           userRoles.includes("DEAN")) &&
          ticketInfo.department === req.session.department) {
        return next();
      }

      return res.status(403).json({
        message: "Access denied. You cannot view this ticket.",
      });
    } catch (error) {
      return res.status(500).json({
        message: "Error checking ticket access",
        error: error.message,
      });
    }
  };
}