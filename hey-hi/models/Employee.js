const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    weekStart: { type: String, default: null }, // e.g. '2024-01-01' (Sunday) for period-specific availability; null = legacy/global
    dayOfWeek: { type: Number, required: true }, // 0 (Dim sem 1) to 13 (Sam sem 2)
    isAvailable: { type: Boolean, default: true },
    isFixed: { type: Boolean, default: false },
    startTime: { type: String, default: '08:00' },
    endTime: { type: String, default: '17:00' }
}, { _id: false });

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true // allows multiple employees with no username set
    },
    passwordHash: {
        type: String,
        default: null
    },
    department: { 
        type: String, 
        required: true, 
        enum: ['caisses_avant', 'plancher', 'cosmetiques', 'laboratoire'],
        default: 'caisses_avant' 
    },
    employeeType: {
        type: String,
        enum: ['temps-plein', 'temps-partiel'],
        default: 'temps-plein'
    },
    weeklyHoursTarget: {
        type: Number,
        default: 37.5 // Full-time default; set to ~20 for part-time
    },
    seniority: {
        type: Number,
        default: 10 // Lower number = more seniority priority
    },
    lunchBreakMinutes: {
        type: Number,
        default: 60 // Default 60 minutes lunch break
    },
    maxEveningShifts: {
        type: Number,
        default: undefined // Nombre max de soirs/semaine (undefined = comportement legacy : jusqu'à 3)
    },
    isFormation: {
        type: Boolean,
        default: false
    },
    isHeadCashier: {
        type: Boolean,
        default: false
    },
    vacations: [{
        startDate: String,
        endDate: String
    }],
    availabilities: {
        type: [availabilitySchema],
        default: () => {
            return [0, 1, 2, 3, 4, 5, 6].map(day => ({
                dayOfWeek: day,
                isAvailable: true,
                startTime: '09:00',
                endTime: '17:00'
            }));
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create a virtual 'id' property that maps to '_id'
employeeSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

// Ensure virtual fields are serialized
employeeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.passwordHash;
    }
});

module.exports = mongoose.model('Employee', employeeSchema);
