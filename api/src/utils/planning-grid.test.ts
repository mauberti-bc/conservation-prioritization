import { expect } from 'chai';
import { createPlanningGridDefinition, encodeGridCellId, getPlanningGridLevel } from './planning-grid';

describe('planning-grid', () => {
  it('uses immutable nested levels and stable numeric cell identity', () => {
    expect(getPlanningGridLevel(30)).to.equal(0);
    expect(getPlanningGridLevel(1920)).to.equal(6);
    expect(encodeGridCellId(4, 6, 7)).to.equal(34n);
    const definition = createPlanningGridDefinition(240, 'mask', null, null, {});
    expect(definition.grid_family_id).to.equal('bc_albers_30m_v1');
    expect(definition.grid_level).to.equal(3);
    expect(definition.aoi_inclusion_rule).to.equal('cell_center_v1');
    const bounded = createPlanningGridDefinition(240, 'mask', [0, 0, 960, 960], [32, 32], {});
    expect(bounded.transform).to.deep.equal([0, 240, 0, 960, 0, -240]);
  });

  it('rejects arbitrary non-nested planning resolutions', () => {
    expect(() => getPlanningGridLevel(1000)).to.throw('Unsupported planning-unit resolution');
  });
});
