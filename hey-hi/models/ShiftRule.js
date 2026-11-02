const mongoose = require('mongoose');

const requiredShiftSchema = new mongoose.Schema({
    startTime: { type: String, required: true },
    endTime:   { type: String, required: true },
    count:     { type: Number, required: true, default: 1 } // nb of employees needed
}, { _id: false });

const shiftRuleSchema = new mongoose.Schema({
    dayOfWeek: { type: Number, required: true }, // 0=Dim, 1=Lun ... 6=Sam
    weekStart: { type: String, default: null }, // YYYY-MM-DD (dimanche) ou null pour règle générique
    department: { 
        type: String, 
        required: true, 
        enum: ['caisses_avant', 'plancher', 'cosmetiques', 'laboratoire'],
        default: 'caisses_avant' 
    },
    isOpen:    { type: Boolean, default: true },
    requiredShifts: { type: [requiredShiftSchema], default: [] }
});

shiftRuleSchema.index({ dayOfWeek: 1, department: 1, weekStart: 1 }, { unique: true });

shiftRuleSchema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
    }
});

module.exports = mongoose.model('ShiftRule', shiftRuleSchema);
