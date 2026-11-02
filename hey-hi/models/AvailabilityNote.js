const mongoose = require('mongoose');

const availabilityNoteSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: String, // format YYYY-MM-DD
        required: true
    },
    department: {
        type: String,
        required: true,
        enum: ['caisses_avant', 'plancher', 'cosmetiques', 'laboratoire'],
        default: 'caisses_avant'
    },
    note: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['dispo', 'non-dispo', 'partial', 'other'],
        default: 'other'
    },
    startTime: {
        type: String,
        default: null
    },
    endTime: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// One note per employee per date per department
availabilityNoteSchema.index({ employeeId: 1, date: 1, department: 1 }, { unique: true });

availabilityNoteSchema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
    }
});

module.exports = mongoose.model('AvailabilityNote', availabilityNoteSchema);
