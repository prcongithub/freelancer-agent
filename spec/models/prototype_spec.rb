require 'rails_helper'

RSpec.describe Prototype, type: :model do
  it "generates a proto_id before create" do
    p = Prototype.new(project_id: "abc123", status: "generating")
    p.save!
    expect(p.proto_id).to match(/\A[a-z0-9]{6}\z/)
  end

  it "validates status inclusion" do
    p = Prototype.new(project_id: "abc123", status: "invalid", proto_id: "x1y2z3")
    expect(p).not_to be_valid
  end

  it "is invalid without project_id" do
    p = Prototype.new(status: "generating", proto_id: "x1y2z3")
    expect(p).not_to be_valid
  end
end
