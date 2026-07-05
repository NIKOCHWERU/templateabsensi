import { z } from 'zod';
import { insertUserSchema, insertAnnouncementSchema, insertLeaveRequestSchema } from './schema.js';
export const errorSchemas = {
    validation: z.object({
        message: z.string(),
        field: z.string().optional(),
    }),
    notFound: z.object({
        message: z.string(),
    }),
    internal: z.object({
        message: z.string(),
    }),
    unauthorized: z.object({
        message: z.string(),
    })
};
export const api = {
    auth: {
        login: {
            method: 'POST',
            path: '/api/login',
            input: z.object({
                username: z.string(), // Email for admin, NIK for employee
                password: z.string(),
                role: z.enum(['admin', 'employee']).default('employee')
            }),
            responses: {
                200: z.custom(),
                401: errorSchemas.unauthorized,
            },
        },
        logout: {
            method: 'POST',
            path: '/api/logout',
            responses: {
                200: z.object({ message: z.string() }),
            },
        },
        me: {
            method: 'GET',
            path: '/api/user',
            responses: {
                200: z.custom(),
                401: errorSchemas.unauthorized,
            },
        },
    },
    leave: {
        list: {
            method: 'GET',
            path: '/api/leave-requests',
            responses: {
                200: z.array(z.custom()),
            },
        },
        create: {
            method: 'POST',
            path: '/api/leave-requests',
            input: insertLeaveRequestSchema.extend({
                selectedDates: z.array(z.string()).optional(),
            }),
            responses: {
                201: z.custom(),
                400: errorSchemas.validation,
            },
        },
        cancel: {
            method: 'POST',
            path: '/api/leave-requests/:id/cancel',
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        },
        balance: {
            method: 'GET',
            path: '/api/leave-balance',
            responses: {
                200: z.object({
                    used: z.number(),
                    remaining: z.number(),
                    limit: z.number(),
                }),
            },
        },
    },
    attendance: {
        clockIn: {
            method: 'POST',
            path: '/api/attendance/clock-in',
            input: z.object({
                checkInPhoto: z.string().optional(),
                location: z.string().optional(),
            }),
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        },
        clockOut: {
            method: 'POST',
            path: '/api/attendance/clock-out',
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        },
        breakStart: {
            method: 'POST',
            path: '/api/attendance/break-start',
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        },
        breakEnd: {
            method: 'POST',
            path: '/api/attendance/break-end',
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        },
        permit: {
            method: 'POST',
            path: '/api/attendance/permit',
            input: z.object({
                notes: z.string(),
                type: z.enum(['sick', 'permission']),
            }),
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        },
        list: {
            method: 'GET',
            path: '/api/attendance',
            input: z.object({
                month: z.string().optional(), // YYYY-MM
                userId: z.string().optional(),
            }).optional(),
            responses: {
                200: z.array(z.custom()),
            },
        },
        today: {
            method: 'GET',
            path: '/api/attendance/today',
            responses: {
                200: z.custom().nullable(),
            },
        },
        resume: {
            method: 'POST',
            path: '/api/attendance/resume',
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
            },
        }
    },
    announcements: {
        list: {
            method: 'GET',
            path: '/api/announcements',
            responses: {
                200: z.array(z.custom()),
            },
        },
        create: {
            method: 'POST',
            path: '/api/announcements',
            input: insertAnnouncementSchema,
            responses: {
                201: z.custom(),
                401: errorSchemas.unauthorized,
            },
        },
        update: {
            method: 'PATCH',
            path: '/api/announcements/:id',
            input: insertAnnouncementSchema.partial(),
            responses: {
                200: z.custom(),
                400: errorSchemas.validation,
                401: errorSchemas.unauthorized,
            },
        },
    },
    admin: {
        users: {
            list: {
                method: 'GET',
                path: '/api/admin/users',
                responses: {
                    200: z.array(z.custom()),
                    401: errorSchemas.unauthorized,
                },
            },
            create: {
                method: 'POST',
                path: '/api/admin/users',
                input: insertUserSchema,
                responses: {
                    201: z.custom(),
                    400: errorSchemas.validation,
                },
            },
            delete: {
                method: 'DELETE',
                path: '/api/admin/users/:id',
                responses: {
                    204: z.void(),
                    400: errorSchemas.validation,
                    401: errorSchemas.unauthorized,
                },
            },
        },
        dashboard: {
            stats: {
                method: 'GET',
                path: '/api/admin/stats',
                responses: {
                    200: z.object({
                        totalEmployees: z.number(),
                        presentToday: z.number(),
                        // Add more stats as needed
                    }),
                },
            },
        },
        attendance: {
            manual: {
                method: 'POST',
                path: '/api/admin/attendance/manual',
                input: z.object({
                    userId: z.number(),
                    date: z.string(), // YYYY-MM-DD
                    status: z.enum(['present', 'late', 'sick', 'permission', 'cuti', 'absent']),
                    notes: z.string().optional(),
                    shift: z.string().optional(),
                }),
                responses: {
                    200: z.custom(),
                    400: errorSchemas.validation,
                    401: errorSchemas.unauthorized,
                },
            },
            leave: {
                list: {
                    method: 'GET',
                    path: '/api/admin/leave-requests',
                    responses: {
                        200: z.array(z.custom()),
                        401: errorSchemas.unauthorized,
                    },
                },
                update: {
                    method: 'PATCH',
                    path: '/api/admin/leave-requests/:id',
                    input: z.object({
                        status: z.enum(['approved', 'rejected']),
                    }),
                    responses: {
                        200: z.custom(),
                        400: errorSchemas.validation,
                        401: errorSchemas.unauthorized,
                    },
                },
            },
        },
    },
};
export function buildUrl(path, params) {
    let url = path;
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (url.includes(`:${key}`)) {
                url = url.replace(`:${key}`, String(value));
            }
        });
    }
    return url;
}
