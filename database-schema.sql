-- Portaria Database Schema for Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for system users (porteiros, supervisores, etc.)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    cargo VARCHAR(50) NOT NULL DEFAULT 'porteiro', -- porteiro, supervisor, administrador
    turno VARCHAR(20) NOT NULL DEFAULT 'diurno', -- diurno, noturno, integral
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for parking spots (vagas)
CREATE TABLE IF NOT EXISTS vagas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero VARCHAR(10) NOT NULL UNIQUE,
    bloco VARCHAR(10) NOT NULL,
    tipo VARCHAR(20) DEFAULT 'carro', -- carro, moto
    ocupada BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for persons (pessoas)
CREATE TABLE IF NOT EXISTS pessoas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    apartamento VARCHAR(10) NOT NULL,
    bloco VARCHAR(10) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(255),
    foto_facial TEXT, -- URL or base64 encoded face image
    facial_descriptors JSONB, -- Store face-api.js descriptors as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for vehicles (veículos)
CREATE TABLE IF NOT EXISTS veiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    modelo VARCHAR(100) NOT NULL,
    placa VARCHAR(20) NOT NULL UNIQUE,
    vaga_id UUID REFERENCES vagas(id) ON DELETE SET NULL,
    cor VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for persons and parking spots (many-to-many)
CREATE TABLE IF NOT EXISTS pessoa_vagas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    vaga_id UUID NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pessoa_id, vaga_id)
);

-- Table for access logs (registros de entrada/saída)
CREATE TABLE IF NOT EXISTS registros_acesso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
    veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL, -- 'entrada' ou 'saida'
    foto_captura TEXT, -- Camera capture
    placa_capturada VARCHAR(20), -- OCR captured plate
    reconhecido BOOLEAN DEFAULT false,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome);
CREATE INDEX IF NOT EXISTS idx_pessoas_apartamento ON pessoas(apartamento, bloco);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_pessoa ON veiculos(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_registros_created ON registros_acesso(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pessoa_vagas_pessoa ON pessoa_vagas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoa_vagas_vaga ON pessoa_vagas(vaga_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at automatically
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vagas_updated_at BEFORE UPDATE ON vagas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pessoas_updated_at BEFORE UPDATE ON pessoas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_veiculos_updated_at BEFORE UPDATE ON veiculos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoa_vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_acesso ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
-- Note: Adjust these policies based on your security requirements

-- Usuarios policies
CREATE POLICY "Users can view their own profile" ON usuarios
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON usuarios
    FOR UPDATE USING (auth.uid() = id);

-- Política temporária para permitir inserção durante cadastro
-- Em produção, ajuste conforme necessário
CREATE POLICY "Enable insert for new users" ON usuarios
    FOR INSERT WITH CHECK (true);

-- Vagas policies
CREATE POLICY "Enable read access for authenticated users" ON vagas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON vagas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON vagas
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Pessoas policies
CREATE POLICY "Enable read access for authenticated users" ON pessoas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON pessoas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON pessoas
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON pessoas
    FOR DELETE USING (auth.role() = 'authenticated');

-- Veiculos policies
CREATE POLICY "Enable read access for authenticated users" ON veiculos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON veiculos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON veiculos
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON veiculos
    FOR DELETE USING (auth.role() = 'authenticated');

-- Pessoa_vagas policies
CREATE POLICY "Enable read access for authenticated users" ON pessoa_vagas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON pessoa_vagas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON pessoa_vagas
    FOR DELETE USING (auth.role() = 'authenticated');

-- Registros_acesso policies
CREATE POLICY "Enable read access for authenticated users" ON registros_acesso
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON registros_acesso
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert some sample data for testing (optional)
INSERT INTO vagas (numero, bloco, tipo) VALUES
    ('A1', 'A', 'carro'),
    ('A2', 'A', 'carro'),
    ('A3', 'A', 'moto'),
    ('B1', 'B', 'carro'),
    ('B2', 'B', 'carro'),
    ('C1', 'C', 'carro')
ON CONFLICT (numero) DO NOTHING;
