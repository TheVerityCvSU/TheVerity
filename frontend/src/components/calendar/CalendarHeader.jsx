import { ChevronDown } from 'lucide-react';

export default function CalendarHeader({
  goToday,
  filterClass,
  setFilterClass,
  isDropdownOpen,
  setIsDropdownOpen,
  sortedClassrooms = [],
  classrooms = [],
  eventsCount = 0,
  isDark,
  styles,
}) {
  return (
    <div style={styles.topControlBar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={goToday}
          style={styles.todayBtn}
          className="btn-anim"
          title="Jump to current week"
        >
          Today
        </button>

        {/* Classroom Filter Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            style={styles.filterDropdownBtn}
            className="btn-anim"
          >
            <span>
              {filterClass === 'all'
                ? 'All Classrooms'
                : classrooms.find((c) => String(c.id) === String(filterClass))?.name || 'Selected Class'}
            </span>
            <ChevronDown
              size={14}
              style={{
                transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </button>

          {isDropdownOpen && (
            <div style={styles.dropdownMenu}>
              <div
                onClick={() => {
                  setFilterClass('all');
                  setIsDropdownOpen(false);
                }}
                style={styles.dropdownItem(filterClass === 'all')}
              >
                All Classrooms
              </div>
              {sortedClassrooms.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setFilterClass(String(c.id));
                    setIsDropdownOpen(false);
                  }}
                  style={styles.dropdownItem(filterClass === String(c.id))}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
        {eventsCount} scheduled event{eventsCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

