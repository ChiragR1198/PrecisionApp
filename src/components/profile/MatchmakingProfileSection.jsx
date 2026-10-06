import Icon from '@expo/vector-icons/Feather';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  MATCH_AVAILABILITY,
  MATCH_COMPANY_TYPES,
  MATCH_DELEGATE_GOALS,
  MATCH_FUNCTIONS,
  MATCH_SENIORITY,
  MATCH_SPONSOR_TOPICS,
  MATCH_TOPICS,
  MATCH_VISIBILITY_MAP,
} from '../../constants/matchOptions';
import { colors, radius } from '../../constants/theme';

function SingleSelectField({ label, value, options, onChange, placeholder = 'Please Select' }) {
  const [open, setOpen] = useState(false);
  const display = value || placeholder;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectTrigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.selectTriggerText, !value && styles.placeholder]} numberOfLines={1}>
          {display}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.icon} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Icon name="x" size={22} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, !value && styles.optionSelected]}>{placeholder}</Text>
                {!value ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
              {options.map((opt) => {
                const selected = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={styles.optionRow}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionSelected]}>{opt}</Text>
                    {selected ? <Icon name="check" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MultiSelectField({ label, values, options, onChange, hint }) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(values) ? values : [];
  const countLabel = selected.length ? `${selected.length} selected` : 'Select options...';

  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((v) => v !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectTrigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.selectTriggerText, !selected.length && styles.placeholder]} numberOfLines={1}>
          {countLabel}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.icon} />
      </TouchableOpacity>

      {selected.length > 0 ? (
        <View style={styles.chipWrap}>
          {selected.map((tag) => (
            <TouchableOpacity key={tag} style={styles.chip} onPress={() => toggle(tag)} activeOpacity={0.7}>
              <Text style={styles.chipText} numberOfLines={1}>
                {tag}
              </Text>
              <Icon name="x" size={12} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {options.map((opt) => {
                const isOn = selected.includes(opt);
                return (
                  <TouchableOpacity key={opt} style={styles.optionRow} onPress={() => toggle(opt)}>
                    <Text style={[styles.optionText, isOn && styles.optionSelected]}>{opt}</Text>
                    <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                      {isOn ? <Icon name="check" size={14} color="#fff" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * AI Matchmaking Profile section for delegate / sponsor Profile screen.
 */
export function MatchmakingProfileSection({ isDelegate, value, onChange, matchOptions }) {
  const companyTypes = matchOptions?.company_types?.length ? matchOptions.company_types : MATCH_COMPANY_TYPES;
  const seniority = matchOptions?.seniority?.length ? matchOptions.seniority : MATCH_SENIORITY;
  const availability = matchOptions?.availability?.length ? matchOptions.availability : MATCH_AVAILABILITY;
  const functions = matchOptions?.functions?.length ? matchOptions.functions : MATCH_FUNCTIONS;
  const goals = matchOptions?.goals?.length ? matchOptions.goals : MATCH_DELEGATE_GOALS;
  const topics = matchOptions?.topics?.length
    ? matchOptions.topics
    : isDelegate
      ? MATCH_TOPICS
      : MATCH_SPONSOR_TOPICS;

  const visibilityMap = useMemo(() => {
    if (matchOptions?.visibility_map && typeof matchOptions.visibility_map === 'object') {
      return matchOptions.visibility_map;
    }
    return MATCH_VISIBILITY_MAP;
  }, [matchOptions]);

  const visibilityOptions = useMemo(
    () => Object.entries(visibilityMap).map(([key, label]) => ({ key, label })),
    [visibilityMap]
  );

  const visibilityLabel = visibilityMap[value.matchVisibility] || visibilityMap.everyone || 'Everyone in this event';

  const set = (field, next) => onChange({ ...value, [field]: next });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AI Matchmaking Profile</Text>
      <Text style={styles.sectionSub}>
        Used for event match recommendations. Multi-select values are stored as tags.
      </Text>

      <View style={styles.card}>
        <SingleSelectField
          label="Company Type"
          value={value.companyType}
          options={companyTypes}
          onChange={(v) => set('companyType', v)}
        />

        {isDelegate ? (
          <>
            <SingleSelectField
              label="Seniority"
              value={value.seniority}
              options={seniority}
              onChange={(v) => set('seniority', v)}
            />
            <SingleSelectField
              label="Availability"
              value={value.meetingAvailability}
              options={availability}
              onChange={(v) => set('meetingAvailability', v)}
            />
          </>
        ) : null}

        <SingleSelectField
          label="Match Visibility"
          value={visibilityLabel}
          options={visibilityOptions.map((o) => o.label)}
          onChange={(label) => {
            const found = visibilityOptions.find((o) => o.label === label);
            set('matchVisibility', found ? found.key : 'everyone');
          }}
          placeholder="Everyone in this event"
        />

        <View style={styles.consentRow}>
          <View style={styles.consentTextWrap}>
            <Text style={styles.fieldLabel}>Appear in AI Matches</Text>
            <Text style={styles.hint}>Allow others to see you in match recommendations</Text>
          </View>
          <Switch
            value={!!value.matchConsent}
            onValueChange={(v) => set('matchConsent', v)}
            trackColor={{ false: '#D1D5DB', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {isDelegate ? (
          <>
            <MultiSelectField
              label="Function"
              values={value.jobFunction}
              options={functions}
              onChange={(v) => set('jobFunction', v)}
            />
            <MultiSelectField
              label="Goals at this event"
              values={value.eventGoals}
              options={goals}
              onChange={(v) => set('eventGoals', v)}
            />
            <MultiSelectField
              label="Topics of interest / needs"
              values={value.topicsOfInterest}
              options={topics}
              onChange={(v) => set('topicsOfInterest', v)}
              hint="Topics and challenges in one list"
            />
          </>
        ) : (
          <>
            <MultiSelectField
              label="Topics / Capabilities"
              values={value.topicsCapabilities}
              options={topics}
              onChange={(v) => set('topicsCapabilities', v)}
              hint="Topics, solutions, and problems you cover"
            />
            <MultiSelectField
              label="Ideal Customer Types"
              values={value.idealCustomerTypes}
              options={companyTypes}
              onChange={(v) => set('idealCustomerTypes', v)}
            />
            <MultiSelectField
              label="Target Functions"
              values={value.targetFunctions}
              options={functions}
              onChange={(v) => set('targetFunctions', v)}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius?.lg || 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginRight: 8,
  },
  placeholder: {
    color: '#9CA3AF',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8F5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 12,
    color: colors.primary,
    maxWidth: 220,
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingVertical: 4,
  },
  consentTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  modalList: {
    paddingHorizontal: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginRight: 12,
  },
  optionSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
