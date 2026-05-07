require 'rails_helper'

RSpec.describe AgentConfig, type: :model do
  describe 'validations' do
    it 'is valid with a known agent name' do
      expect(AgentConfig.new(agent: 'scanner')).to be_valid
    end

    it 'is invalid with an unknown agent' do
      cfg = AgentConfig.new(agent: 'unknown')
      expect(cfg).not_to be_valid
      expect(cfg.errors[:agent]).to be_present
    end

    it 'requires uniqueness on agent' do
      AgentConfig.create!(agent: 'analyzer')
      dup = AgentConfig.new(agent: 'analyzer')
      expect(dup).not_to be_valid
    end
  end

  describe '.for' do
    it 'creates a record with defaults when missing' do
      cfg = AgentConfig.for('scanner')
      expect(cfg).to be_persisted
      expect(cfg.config['threshold']).to eq(65)
    end

    it 'returns existing record without overwriting' do
      AgentConfig.create!(agent: 'scanner', config: { 'threshold' => 99 })
      cfg = AgentConfig.for('scanner')
      expect(cfg.config['threshold']).to eq(99)
    end
  end

  describe '.seed_defaults!' do
    it 'creates documents for all 6 agents' do
      AgentConfig.seed_defaults!
      expect(AgentConfig.count).to eq(6)
    end

    it 'does not overwrite existing records' do
      AgentConfig.create!(agent: 'tracker', config: { 'auto_bid_threshold' => 42 })
      AgentConfig.seed_defaults!
      expect(AgentConfig.for('tracker').config['auto_bid_threshold']).to eq(42)
    end
  end
end
